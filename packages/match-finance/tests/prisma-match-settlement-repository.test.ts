/* eslint-disable @typescript-eslint/no-unsafe-return -- generated Prisma test doubles return captured shapes. */
import type { ArenaPrismaClient } from '@arena-core/database';
import { describe, expect, it, vi } from 'vitest';
import { PrismaMatchSettlementRepository } from '../src';
describe('Prisma match settlement repository', () => {
  it('loads only settlement context and the match escrow projection', async () => {
    const findUnique = vi.fn(async () => ({
      id: 'm1',
      status: 'COMPLETED',
      completedAt: new Date(),
      settlementEligibleAt: new Date(0),
      result: {
        id: 'result1',
        status: 'CONFIRMED',
        version: 1,
        winnerParticipantId: 'p1',
        isDraw: false,
      },
      disputes: [],
      entryReservations: [
        {
          id: 'r1',
          participantId: 'p1',
          userId: 'u1',
          ledgerAccountId: 'a1',
          escrowAccountId: 'e1',
          assetCode: 'ARENA_POINT',
          amount: 10n,
          status: 'RELEASED',
        },
      ],
      settlement: null,
    }));
    const client = {
      match: { findUnique },
      ledgerAccount: { findUnique: vi.fn(async () => ({ currentBalance: 10n })) },
    } as unknown as ArenaPrismaClient;
    const context = await new PrismaMatchSettlementRepository(client).findSettlementContext('m1');
    expect(context).toMatchObject({ matchId: 'm1', escrowBalance: 10n, activeDispute: false });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ user: expect.anything() }),
      }),
    );
  });
  it('creates the terminal settlement and finalizes every reservation', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated Prisma argument mock.
    const create = vi.fn(async (args: any) => ({
      ...args.data,
      status: 'SETTLED',
      distributedAmount: 20n,
      refundedAmount: 0n,
      retainedAmount: 0n,
    }));
    const update = vi.fn(async () => ({ id: 'r1' }));
    const client = {
      matchSettlement: { create },
      matchEntryReservation: { update },
    } as unknown as ArenaPrismaClient;
    const repository = new PrismaMatchSettlementRepository(client);
    await repository.createSettlement({
      id: 's1',
      context: {
        matchId: 'm1',
        matchStatus: 'COMPLETED',
        completedAt: new Date(),
        settlementEligibleAt: new Date(),
        resultId: 'result1',
        resultStatus: 'CONFIRMED',
        resultVersion: 1,
        winnerParticipantId: 'p1',
        isDraw: false,
        terminalDisputeId: null,
        terminalDisputeResolvedAt: null,
        activeDispute: false,
        reservations: [
          {
            id: 'r1',
            participantId: 'p1',
            userId: 'u1',
            ledgerAccountId: 'a1',
            escrowAccountId: 'e1',
            assetCode: 'ARENA_POINT',
            amount: 20n,
            status: 'RELEASED',
          },
        ],
        escrowBalance: 20n,
        settlementExists: false,
      },
      type: 'WINNER_TAKES_ALL',
      total: 20n,
      transactionId: 'tx1',
      idempotencyKey: 'settle-001',
      fingerprint: 'a'.repeat(64),
      now: new Date(),
      outcomes: new Map([['r1', 'WINNER_CREDITED']]),
    });
    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SETTLED', settlementOutcome: 'WINNER_CREDITED' }),
      }),
    );
  });
  it('bounds recovery at the repository query', async () => {
    const findMany = vi.fn(async () => [{ id: 'm1' }]);
    const client = { match: { findMany } } as unknown as ArenaPrismaClient;
    await new PrismaMatchSettlementRepository(client).listEligibleMatches(new Date(), 25);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
