import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DirectMatchFinanceTransactionManager,
  MatchEntryReservationService,
  MatchFinanceError,
  type MatchEntryReservationRecord,
  type MatchFinanceContext,
  type MatchFinanceRepository,
  type WalletLedgerPort,
} from '../src';

const now = new Date('2026-07-27T12:00:00.000Z');
const context: MatchFinanceContext = {
  matchId: '00000000-0000-4000-8000-000000000001',
  matchStatus: 'AWAITING_READY',
  participantId: '00000000-0000-4000-8000-000000000002',
  participantSide: 'SIDE_A',
  participantStatus: 'PENDING',
  userId: '00000000-0000-4000-8000-000000000003',
  rulesetConfiguration: {
    entryRequirement: {
      assetCode: 'ARENA_POINT',
      amountPerParticipant: '100',
      required: true,
    },
  },
  readyDeadlineAt: new Date('2026-07-27T12:10:00.000Z'),
};

describe('reservation service', () => {
  let records: MatchEntryReservationRecord[];
  let balance: bigint;
  let escrow: bigint;
  let repository: MatchFinanceRepository;
  let ledger: WalletLedgerPort;
  let service: MatchEntryReservationService;

  beforeEach(() => {
    records = [];
    balance = 150n;
    escrow = 0n;
    repository = {
      findContext: vi.fn(async (userId, matchId) =>
        userId === context.userId && matchId === context.matchId ? context : null,
      ),
      findContextByParticipant: vi.fn(async () => context),
      listContexts: vi.fn(async () => [context]),
      findByParticipant: vi.fn(
        async (matchId, participantId) =>
          records.find((row) => row.matchId === matchId && row.participantId === participantId) ??
          null,
      ),
      findByIdempotencyKey: vi.fn(
        async (key) => records.find((row) => row.idempotencyKey === key) ?? null,
      ),
      create: vi.fn(async (input) => {
        const row: MatchEntryReservationRecord = {
          id: input.id,
          matchId: input.context.matchId,
          participantId: input.context.participantId,
          userId: input.context.userId,
          assetCode: 'ARENA_POINT',
          amount: input.amount,
          status: input.status,
          requirementSnapshot: input.requirement,
          reservationSnapshot: {
            schemaVersion: 1,
            assetCode: 'ARENA_POINT',
            amount: input.amount.toString(),
            required: input.requirement.required,
            matchId: input.context.matchId,
            participantSide: input.context.participantSide,
          },
          ledgerTransactionId: input.ledgerTransactionId,
          refundLedgerTransactionId: null,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          reservedAt: input.status === 'RESERVED' ? input.now : null,
          releasedAt: null,
          refundedAt: null,
          expiresAt: input.expiresAt,
          version: 1,
          createdAt: input.now,
        };
        records.push(row);
        return row;
      }),
      findMine: vi.fn(async () => records[0] ?? null),
      listMine: vi.fn(async () => records),
      listMatch: vi.fn(async () => records),
      releaseMatch: vi.fn(async () => records),
      markRefunded: vi.fn(async () => {
        throw new Error('unused');
      }),
      listRefundable: vi.fn(async () => []),
      getMatchStatus: vi.fn(async () => 'CANCELLED' as const),
    };
    ledger = {
      reserve: vi.fn(async (input) => {
        if (balance < input.amount)
          throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_INSUFFICIENT_BALANCE');
        balance -= input.amount;
        escrow += input.amount;
        return {
          walletId: 'wallet',
          userAccountId: 'available',
          escrowAccountId: 'escrow',
          transactionId: 'transaction',
        };
      }),
      refund: vi.fn(async () => ({ transactionId: 'refund' })),
      reconcileMatchEscrow: vi.fn(async (_matchId, expectedBalance, reservationCount) => ({
        consistent: escrow === expectedBalance,
        escrowBalance: escrow,
        expectedBalance,
        difference: escrow - expectedBalance,
        reservationCount,
      })),
    };
    service = new MatchEntryReservationService(
      repository,
      ledger,
      new DirectMatchFinanceTransactionManager(),
      { now: () => now },
      { generate: () => 'reservation' },
      300,
    );
  });

  it('posts a balanced reservation movement and returns a safe projection', async () => {
    const result = await service.reserve({
      matchId: context.matchId,
      userId: context.userId,
      idempotencyKey: 'reserve-key-001',
    });
    expect(result).toMatchObject({ status: 'RESERVED', amount: '100' });
    expect(balance).toBe(50n);
    expect(escrow).toBe(100n);
    expect(result).not.toHaveProperty('ledgerTransactionId');
  });
  it('returns the same reservation for an exact retry', async () => {
    const input = {
      matchId: context.matchId,
      userId: context.userId,
      idempotencyKey: 'reserve-key-001',
    };
    expect(await service.reserve(input)).toEqual(await service.reserve(input));
    expect(ledger.reserve).toHaveBeenCalledTimes(1);
  });
  it('rejects an idempotency key bound to a different fingerprint', async () => {
    await service.reserve({
      matchId: context.matchId,
      userId: context.userId,
      idempotencyKey: 'reserve-key-001',
    });
    records[0] = { ...records[0]!, requestFingerprint: '0'.repeat(64) };
    await expect(
      service.reserve({
        matchId: context.matchId,
        userId: context.userId,
        idempotencyKey: 'reserve-key-001',
      }),
    ).rejects.toMatchObject({ code: 'MATCH_ENTRY_RESERVATION_IDEMPOTENCY_CONFLICT' });
  });
  it('prevents a negative user balance', async () => {
    balance = 99n;
    await expect(
      service.reserve({
        matchId: context.matchId,
        userId: context.userId,
        idempotencyKey: 'reserve-key-001',
      }),
    ).rejects.toMatchObject({ code: 'MATCH_ENTRY_RESERVATION_INSUFFICIENT_BALANCE' });
    expect(balance).toBe(99n);
    expect(escrow).toBe(0n);
  });
  it('rejects a cross-user reservation', async () => {
    await expect(
      service.reserve({
        matchId: context.matchId,
        userId: 'other-user',
        idempotencyKey: 'reserve-key-001',
      }),
    ).rejects.toMatchObject({ code: 'MATCH_ENTRY_RESERVATION_PARTICIPANT_INVALID' });
  });
  it('creates NOT_REQUIRED without touching ledger', async () => {
    Object.assign(context, { rulesetConfiguration: {} });
    const result = await service.reserve({
      matchId: context.matchId,
      userId: context.userId,
      idempotencyKey: 'reserve-key-001',
    });
    expect(result).toMatchObject({ status: 'NOT_REQUIRED', amount: '0' });
    expect(ledger.reserve).not.toHaveBeenCalled();
  });
});
