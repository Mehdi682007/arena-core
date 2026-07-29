/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-explicit-any -- concise test expectations and adapter capture. */
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateMatchSettlementEligibility,
  MatchSettlementError,
  MatchSettlementService,
  settlementFingerprint,
  type MatchSettlementContext,
  type MatchSettlementRecord,
} from '../src';
const now = new Date('2026-07-28T12:00:00Z');
const reservations = [
  {
    id: 'r1',
    participantId: 'p1',
    userId: 'u1',
    ledgerAccountId: 'a1',
    escrowAccountId: 'escrow',
    assetCode: 'ARENA_POINT',
    amount: 40n,
    status: 'RELEASED',
  },
  {
    id: 'r2',
    participantId: 'p2',
    userId: 'u2',
    ledgerAccountId: 'a2',
    escrowAccountId: 'escrow',
    assetCode: 'ARENA_POINT',
    amount: 60n,
    status: 'RELEASED',
  },
] as const;
const context = (patch: Partial<MatchSettlementContext> = {}): MatchSettlementContext => ({
  matchId: 'm1',
  matchStatus: 'COMPLETED',
  completedAt: new Date('2026-07-26T12:00:00Z'),
  settlementEligibleAt: new Date('2026-07-27T12:00:00Z'),
  resultId: 'result1',
  resultStatus: 'CONFIRMED',
  resultVersion: 1,
  winnerParticipantId: 'p1',
  isDraw: false,
  terminalDisputeId: null,
  terminalDisputeResolvedAt: null,
  activeDispute: false,
  reservations,
  escrowBalance: 100n,
  settlementExists: false,
  ...patch,
});
describe('settlement eligibility', () => {
  it('accepts a completed winner result', () =>
    expect(evaluateMatchSettlementEligibility(context(), now)).toMatchObject({
      eligible: true,
      type: 'WINNER_TAKES_ALL',
    }));
  it('accepts a final draw', () =>
    expect(evaluateMatchSettlementEligibility(context({ isDraw: true }), now).type).toBe(
      'DRAW_REFUND',
    ));
  it('accepts a void match with reserved entries', () =>
    expect(
      evaluateMatchSettlementEligibility(
        context({
          matchStatus: 'VOIDED',
          resultId: null,
          resultStatus: null,
          reservations: reservations.map((item) => ({ ...item, status: 'RESERVED' })),
        }),
        now,
      ).type,
    ).toBe('VOID_REFUND'));
  it.each([
    ['active dispute', { activeDispute: true }, 'ACTIVE_DISPUTE_EXISTS'],
    [
      'delay',
      { settlementEligibleAt: new Date('2026-07-29T00:00:00Z') },
      'SETTLEMENT_DELAY_NOT_ELAPSED',
    ],
    ['existing', { settlementExists: true }, 'SETTLEMENT_ALREADY_EXISTS'],
    ['escrow mismatch', { escrowBalance: 99n }, 'ESCROW_BALANCE_MISMATCH'],
    ['winner invalid', { winnerParticipantId: 'p3' }, 'WINNER_NOT_PARTICIPANT'],
    ['participant count', { reservations: reservations.slice(0, 1) }, 'PARTICIPANT_COUNT_INVALID'],
  ])('rejects %s', (_name, patch, reason) =>
    expect(evaluateMatchSettlementEligibility(context(patch), now).reasons).toContain(reason),
  );
  it('binds the fingerprint to result revision', () =>
    expect(
      settlementFingerprint({
        matchId: 'm1',
        resultId: 'r1',
        resultVersion: 1,
        type: 'WINNER_TAKES_ALL',
        total: 100n,
      }),
    ).not.toBe(
      settlementFingerprint({
        matchId: 'm1',
        resultId: 'r1',
        resultVersion: 2,
        type: 'WINNER_TAKES_ALL',
        total: 100n,
      }),
    ));
});
describe('settlement application', () => {
  function harness(value = context()) {
    let stored: MatchSettlementRecord | null = null;
    const repository = {
      findSettlementContext: vi.fn(async () => value),
      findSettlementByMatchId: vi.fn(async () => stored),
      findSettlementByIdempotencyKey: vi.fn(async () => null),
      createSettlement: vi.fn(async (input: any) => {
        stored = {
          id: input.id,
          matchId: input.context.matchId,
          status: input.type === 'WINNER_TAKES_ALL' ? 'SETTLED' : 'REFUNDED',
          type: input.type,
          assetCode: 'ARENA_POINT',
          totalEscrowAmount: input.total,
          distributedAmount: input.type === 'WINNER_TAKES_ALL' ? input.total : 0n,
          refundedAmount: input.type === 'WINNER_TAKES_ALL' ? 0n : input.total,
          retainedAmount: 0n,
          winnerParticipantId: input.context.winnerParticipantId,
          resultId: input.context.resultId,
          disputeId: null,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.fingerprint,
          settlementTransactionId: input.transactionId,
          settledAt: input.now,
        };
        return stored;
      }),
      getSettlementForUser: vi.fn(),
      listSettlementsForUser: vi.fn(),
      getSettlementForAdmin: vi.fn(),
      listSettlementsForAdmin: vi.fn(),
      listEligibleMatches: vi.fn(),
      listFailedSettlements: vi.fn(),
    };
    const ledger = {
      postSettlement: vi.fn(async () => ({ transactionId: 'tx1' })),
      getEscrowBalance: vi.fn(async () => 0n),
    };
    const service = new MatchSettlementService(
      repository,
      ledger,
      { transaction: (operation) => operation() },
      { now: () => now },
      { generate: () => 'settlement1' },
    );
    return { service, repository, ledger };
  }
  it('posts the entire winner escrow atomically', async () => {
    const { service, ledger, repository } = harness();
    const result = await service.settle({
      matchId: 'm1',
      idempotencyKey: 'settle-001',
      actorUserId: 'admin',
      operation: 'SYSTEM',
    });
    expect(result.distributedAmount).toBe(100n);
    expect(ledger.postSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'WINNER_TAKES_ALL', winnerParticipantId: 'p1' }),
    );
    expect(repository.createSettlement).toHaveBeenCalledOnce();
  });
  it.each([
    ['draw', context({ isDraw: true }), 'DRAW_REFUND'],
    [
      'void',
      context({
        matchStatus: 'VOIDED',
        resultId: null,
        resultStatus: null,
        reservations: reservations.map((item) => ({ ...item, status: 'RESERVED' })),
      }),
      'VOID_REFUND',
    ],
  ])('posts %s refunds', async (_name, value, type) => {
    const { service, ledger } = harness(value);
    await service.settle({
      matchId: 'm1',
      idempotencyKey: 'settle-002',
      actorUserId: 'admin',
      operation: 'SYSTEM',
    });
    expect(ledger.postSettlement).toHaveBeenCalledWith(expect.objectContaining({ type }));
  });
  it('does not post when an active dispute exists', async () => {
    const { service, ledger } = harness(context({ activeDispute: true }));
    await expect(
      service.settle({
        matchId: 'm1',
        idempotencyKey: 'settle-003',
        actorUserId: 'admin',
        operation: 'SYSTEM',
      }),
    ).rejects.toEqual(new MatchSettlementError('MATCH_SETTLEMENT_ACTIVE_DISPUTE'));
    expect(ledger.postSettlement).not.toHaveBeenCalled();
  });
});
