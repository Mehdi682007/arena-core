import { describe, expect, it, vi } from 'vitest';
import {
  AdminMatchFinanceService,
  DirectMatchFinanceTransactionManager,
  MatchEscrowService,
  type MatchEntryReservationRecord,
  type MatchFinanceRepository,
  type WalletLedgerPort,
} from '../src';

const now = new Date('2026-07-27T12:00:00.000Z');
const row = (status: MatchEntryReservationRecord['status']): MatchEntryReservationRecord => ({
  id: 'reservation',
  matchId: 'match',
  participantId: 'participant',
  userId: 'user',
  assetCode: 'ARENA_POINT',
  amount: 100n,
  status,
  requirementSnapshot: {
    schemaVersion: 1,
    assetCode: 'ARENA_POINT',
    amountPerParticipant: '100',
    required: true,
  },
  reservationSnapshot: {
    schemaVersion: 1,
    assetCode: 'ARENA_POINT',
    amount: '100',
    required: true,
    matchId: 'match',
    participantSide: 'SIDE_A',
  },
  ledgerTransactionId: 'reserve',
  refundLedgerTransactionId: null,
  idempotencyKey: 'key',
  requestFingerprint: 'a'.repeat(64),
  reservedAt: now,
  releasedAt: null,
  refundedAt: null,
  expiresAt: new Date('2099-01-01'),
  version: 1,
  createdAt: now,
});

function adapters(initial: MatchEntryReservationRecord[]) {
  let rows = initial;
  let escrow = rows.reduce((sum, item) => sum + item.amount, 0n);
  const repository: MatchFinanceRepository = {
    findContext: vi.fn(async () => null),
    findContextByParticipant: vi.fn(async (_matchId: string, participantId: string) => ({
      matchId: 'match',
      matchStatus: 'AWAITING_READY' as const,
      participantId,
      participantSide: participantId === 'p2' ? ('SIDE_B' as const) : ('SIDE_A' as const),
      participantStatus: 'PENDING' as const,
      userId: participantId === 'p2' ? 'user-2' : 'user',
      rulesetConfiguration: {
        entryRequirement: {
          assetCode: 'ARENA_POINT',
          amountPerParticipant: '100',
          required: true,
        },
      },
      readyDeadlineAt: new Date('2099-01-01'),
    })),
    listContexts: vi.fn(async () =>
      rows.map((item, index) => ({
        matchId: item.matchId,
        matchStatus: 'AWAITING_READY' as const,
        participantId: item.participantId,
        participantSide: index === 0 ? ('SIDE_A' as const) : ('SIDE_B' as const),
        participantStatus: 'PENDING' as const,
        userId: item.userId,
        rulesetConfiguration: {
          entryRequirement: {
            assetCode: 'ARENA_POINT',
            amountPerParticipant: item.amount.toString(),
            required: item.amount > 0n,
          },
        },
        readyDeadlineAt: new Date('2099-01-01'),
      })),
    ),
    findByParticipant: vi.fn(
      async (_matchId, participantId) =>
        rows.find((item) => item.participantId === participantId) ?? null,
    ),
    findByIdempotencyKey: vi.fn(async () => null),
    create: vi.fn(async () => {
      throw new Error('unused');
    }),
    findMine: vi.fn(async () => null),
    listMine: vi.fn(async () => rows),
    listMatch: vi.fn(async () => rows),
    releaseMatch: vi.fn(async (_matchId, releasedAt) => {
      rows = rows.map((item) =>
        item.status === 'RESERVED'
          ? { ...item, status: 'RELEASED', releasedAt, version: item.version + 1 }
          : item,
      );
      return rows;
    }),
    markRefunded: vi.fn(async (id, transactionId, _reason, _actor, refundedAt) => {
      rows = rows.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'REFUNDED',
              refundLedgerTransactionId: transactionId,
              refundedAt,
            }
          : item,
      );
      return rows.find((item) => item.id === id)!;
    }),
    listRefundable: vi.fn(async () => rows.filter((item) => item.status === 'RESERVED')),
    getMatchStatus: vi.fn(async () => 'CANCELLED' as const),
  };
  const ledger: WalletLedgerPort = {
    reserve: vi.fn(async () => {
      throw new Error('unused');
    }),
    refund: vi.fn(async (input) => {
      if (escrow < input.amount) throw new Error('negative escrow');
      escrow -= input.amount;
      return { transactionId: 'refund' };
    }),
    reconcileMatchEscrow: vi.fn(async (_matchId, expectedBalance, reservationCount) => ({
      consistent: escrow === expectedBalance,
      escrowBalance: escrow,
      expectedBalance,
      difference: escrow - expectedBalance,
      reservationCount,
    })),
  };
  return { repository, ledger, escrow: () => escrow };
}

describe('escrow lifecycle', () => {
  it('allows a zero requirement without creating a reservation', async () => {
    const value = adapters([]);
    value.repository.findContextByParticipant = vi.fn(async () => ({
      matchId: 'match',
      matchStatus: 'AWAITING_READY' as const,
      participantId: 'participant',
      participantSide: 'SIDE_A' as const,
      participantStatus: 'PENDING' as const,
      userId: 'user',
      rulesetConfiguration: {},
      readyDeadlineAt: new Date('2099-01-01'),
    }));
    await expect(
      new MatchEscrowService(value.repository, { now: () => now }).assertParticipantEntrySatisfied(
        'match',
        'participant',
      ),
    ).resolves.toBeUndefined();
  });
  it('accepts reserved entry and releases without ledger movement', async () => {
    const value = adapters([
      row('RESERVED'),
      { ...row('RESERVED'), id: 'two', participantId: 'p2' },
    ]);
    const service = new MatchEscrowService(value.repository, { now: () => now });
    await service.assertParticipantEntrySatisfied('match', 'participant');
    await service.releaseMatch('match');
    expect(value.repository.releaseMatch).toHaveBeenCalledOnce();
    expect(value.ledger.refund).not.toHaveBeenCalled();
  });
  it.each(['REFUNDED', 'EXPIRED', 'CANCELLED'] as const)(
    'rejects %s entry eligibility',
    async (status) => {
      const value = adapters([row(status)]);
      await expect(
        new MatchEscrowService(value.repository, {
          now: () => now,
        }).assertParticipantEntrySatisfied('match', 'participant'),
      ).rejects.toMatchObject({ code: 'MATCH_ENTRY_RESERVATION_STATE_INVALID' });
    },
  );
  it('refunds a pre-start reservation and reconciles to zero', async () => {
    const value = adapters([row('RESERVED')]);
    const service = new AdminMatchFinanceService(
      value.repository,
      value.ledger,
      new DirectMatchFinanceTransactionManager(),
      { now: () => now },
    );
    const result = await service.refund({
      matchId: 'match',
      actorUserId: 'admin',
      idempotencyKey: 'refund-key',
      reasonCode: 'MATCH_CANCELLED',
    });
    expect(result[0]?.status).toBe('REFUNDED');
    expect(value.escrow()).toBe(0n);
    expect(await service.reconcile('match')).toMatchObject({
      consistent: true,
      escrowBalance: 0n,
    });
  });
  it('rejects an automatic refund after match start', async () => {
    const value = adapters([row('RESERVED')]);
    value.repository.getMatchStatus = vi.fn(async () => 'IN_PROGRESS' as const);
    await expect(
      new AdminMatchFinanceService(
        value.repository,
        value.ledger,
        new DirectMatchFinanceTransactionManager(),
        { now: () => now },
      ).refund({
        matchId: 'match',
        actorUserId: 'admin',
        idempotencyKey: 'refund-key',
        reasonCode: 'MATCH_CANCELLED',
      }),
    ).rejects.toMatchObject({ code: 'MATCH_ENTRY_RESERVATION_REFUND_NOT_ALLOWED' });
  });
});
