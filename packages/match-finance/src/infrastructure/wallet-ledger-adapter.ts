import type { ArenaPrismaClient } from '@arena-core/database';
import { MatchFinanceError } from '../domain/match-entry-errors';
import type {
  RefundLedgerInput,
  ReserveLedgerInput,
  ReservationPosting,
  WalletLedgerPort,
} from '../ports/wallet-ledger-port';
import type { PrismaMatchFinanceTransactionManager } from './prisma-match-finance-transaction-manager';

type Client = ArenaPrismaClient | ReturnType<PrismaMatchFinanceTransactionManager['current']>;

export class PrismaWalletLedgerAdapter implements WalletLedgerPort {
  public constructor(
    private readonly source: ArenaPrismaClient | PrismaMatchFinanceTransactionManager,
  ) {}
  private client(): Client {
    return 'current' in this.source ? this.source.current() : this.source;
  }
  public async reserve(input: ReserveLedgerInput): Promise<ReservationPosting> {
    const client = this.client();
    const wallet = await client.wallet.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, createdAt: input.now, updatedAt: input.now },
      update: {},
      select: { id: true, status: true },
    });
    if (wallet.status !== 'ACTIVE')
      throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_STATE_INVALID');
    const userAccount = await client.ledgerAccount.upsert({
      where: {
        walletId_assetCode_type: {
          walletId: wallet.id,
          assetCode: 'ARENA_POINT',
          type: 'USER_AVAILABLE',
        },
      },
      create: {
        walletId: wallet.id,
        assetCode: 'ARENA_POINT',
        type: 'USER_AVAILABLE',
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {},
      select: { id: true },
    });
    const escrow = await client.ledgerAccount.upsert({
      where: {
        systemKey_assetCode: {
          systemKey: `match_escrow:${input.matchId}`,
          assetCode: 'ARENA_POINT',
        },
      },
      create: {
        assetCode: 'ARENA_POINT',
        type: 'MATCH_ESCROW',
        systemKey: `match_escrow:${input.matchId}`,
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {},
      select: { id: true, type: true },
    });
    if (escrow.type !== 'MATCH_ESCROW')
      throw new MatchFinanceError('MATCH_ESCROW_INVARIANT_VIOLATION');
    const debit = await client.ledgerAccount.updateMany({
      where: {
        id: userAccount.id,
        status: 'ACTIVE',
        currentBalance: { gte: input.amount },
      },
      data: { currentBalance: { decrement: input.amount }, version: { increment: 1 } },
    });
    if (debit.count !== 1)
      throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_INSUFFICIENT_BALANCE');
    const [userAfter, escrowAfter] = await Promise.all([
      client.ledgerAccount.findUniqueOrThrow({
        where: { id: userAccount.id },
        select: { currentBalance: true },
      }),
      client.ledgerAccount.update({
        where: { id: escrow.id },
        data: { currentBalance: { increment: input.amount }, version: { increment: 1 } },
        select: { currentBalance: true },
      }),
    ]);
    const transaction = await client.ledgerTransaction.create({
      data: {
        type: 'MATCH_ENTRY_RESERVATION',
        assetCode: 'ARENA_POINT',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.fingerprint,
        referenceType: 'MATCH_ENTRY',
        referenceId: input.matchId,
        description: 'Match entry reservation',
        createdByUserId: input.userId,
        postedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
        entries: {
          create: [
            {
              accountId: userAccount.id,
              direction: 'DEBIT',
              amount: input.amount,
              balanceAfter: userAfter.currentBalance,
              sequence: 1,
              createdAt: input.now,
            },
            {
              accountId: escrow.id,
              direction: 'CREDIT',
              amount: input.amount,
              balanceAfter: escrowAfter.currentBalance,
              sequence: 2,
              createdAt: input.now,
            },
          ],
        },
      },
      select: { id: true },
    });
    return {
      walletId: wallet.id,
      userAccountId: userAccount.id,
      escrowAccountId: escrow.id,
      transactionId: transaction.id,
    };
  }
  public async refund(input: RefundLedgerInput): Promise<{ transactionId: string }> {
    const client = this.client();
    const reservation = await client.matchEntryReservation.findUnique({
      where: { id: input.reservationId },
      select: { ledgerAccountId: true, escrowAccountId: true, status: true },
    });
    if (
      !reservation?.ledgerAccountId ||
      !reservation.escrowAccountId ||
      reservation.status !== 'RESERVED'
    )
      throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_REFUND_NOT_ALLOWED');
    const debit = await client.ledgerAccount.updateMany({
      where: { id: reservation.escrowAccountId, currentBalance: { gte: input.amount } },
      data: { currentBalance: { decrement: input.amount }, version: { increment: 1 } },
    });
    if (debit.count !== 1) throw new MatchFinanceError('MATCH_ESCROW_INVARIANT_VIOLATION');
    const [escrowAfter, userAfter] = await Promise.all([
      client.ledgerAccount.findUniqueOrThrow({
        where: { id: reservation.escrowAccountId },
        select: { currentBalance: true },
      }),
      client.ledgerAccount.update({
        where: { id: reservation.ledgerAccountId },
        data: { currentBalance: { increment: input.amount }, version: { increment: 1 } },
        select: { currentBalance: true },
      }),
    ]);
    const transaction = await client.ledgerTransaction.create({
      data: {
        type: 'MATCH_ENTRY_REFUND',
        assetCode: 'ARENA_POINT',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.fingerprint,
        referenceType: 'MATCH_ENTRY_REFUND',
        referenceId: input.reservationId,
        description: 'Match entry refund',
        createdByUserId: input.actorUserId,
        postedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
        entries: {
          create: [
            {
              accountId: reservation.escrowAccountId,
              direction: 'DEBIT',
              amount: input.amount,
              balanceAfter: escrowAfter.currentBalance,
              sequence: 1,
              createdAt: input.now,
            },
            {
              accountId: reservation.ledgerAccountId,
              direction: 'CREDIT',
              amount: input.amount,
              balanceAfter: userAfter.currentBalance,
              sequence: 2,
              createdAt: input.now,
            },
          ],
        },
      },
      select: { id: true },
    });
    return { transactionId: transaction.id };
  }
  public async reconcileMatchEscrow(
    matchId: string,
    expectedBalance: bigint,
    reservationCount: number,
  ) {
    const account = await this.client().ledgerAccount.findUnique({
      where: {
        systemKey_assetCode: {
          systemKey: `match_escrow:${matchId}`,
          assetCode: 'ARENA_POINT',
        },
      },
      select: { currentBalance: true },
    });
    const escrowBalance = account?.currentBalance ?? 0n;
    return {
      consistent: escrowBalance === expectedBalance,
      escrowBalance,
      expectedBalance,
      difference: escrowBalance - expectedBalance,
      reservationCount,
    };
  }
}
