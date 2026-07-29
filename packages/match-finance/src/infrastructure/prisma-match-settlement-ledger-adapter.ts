import type { ArenaPrismaClient } from '@arena-core/database';
import { MatchSettlementError } from '../domain/match-settlement-errors';
import type { MatchSettlementLedgerPort } from '../ports/match-settlement-ledger-port';
import type { PrismaMatchFinanceTransactionManager } from './prisma-match-finance-transaction-manager';
type Client = ArenaPrismaClient | ReturnType<PrismaMatchFinanceTransactionManager['current']>;
export class PrismaMatchSettlementLedgerAdapter implements MatchSettlementLedgerPort {
  public constructor(
    private readonly source: ArenaPrismaClient | PrismaMatchFinanceTransactionManager,
  ) {}
  private client(): Client {
    return 'current' in this.source ? this.source.current() : this.source;
  }
  public async postSettlement(input: Parameters<MatchSettlementLedgerPort['postSettlement']>[0]) {
    const client = this.client();
    const escrowId = input.reservations[0]?.escrowAccountId;
    if (
      !escrowId ||
      input.reservations.some((item) => item.escrowAccountId !== escrowId || !item.ledgerAccountId)
    )
      throw new MatchSettlementError('MATCH_SETTLEMENT_RESERVATION_INVALID');
    const total = input.reservations.reduce((sum, item) => sum + item.amount, 0n);
    const debit = await client.ledgerAccount.updateMany({
      where: {
        id: escrowId,
        type: 'MATCH_ESCROW',
        assetCode: 'ARENA_POINT',
        currentBalance: total,
      },
      data: { currentBalance: { decrement: total }, version: { increment: 1 } },
    });
    if (debit.count !== 1) throw new MatchSettlementError('MATCH_SETTLEMENT_ESCROW_MISMATCH');
    const escrowAfter = await client.ledgerAccount.findUniqueOrThrow({
      where: { id: escrowId },
      select: { currentBalance: true },
    });
    const recipients =
      input.type === 'WINNER_TAKES_ALL'
        ? input.reservations
            .filter((item) => item.participantId === input.winnerParticipantId)
            .map((item) => ({ ...item, credit: total }))
        : input.reservations.map((item) => ({ ...item, credit: item.amount }));
    if (recipients.length === 0) throw new MatchSettlementError('MATCH_SETTLEMENT_RESULT_INVALID');
    const creditEntries: {
      accountId: string;
      direction: 'CREDIT';
      amount: bigint;
      balanceAfter: bigint;
      sequence: number;
      createdAt: Date;
    }[] = [];
    for (const [index, recipient] of recipients.entries()) {
      const accountId = recipient.ledgerAccountId;
      if (!accountId) throw new MatchSettlementError('MATCH_SETTLEMENT_RESERVATION_INVALID');
      const account = await client.ledgerAccount.update({
        where: { id: accountId },
        data: { currentBalance: { increment: recipient.credit }, version: { increment: 1 } },
        select: { id: true, currentBalance: true },
      });
      creditEntries.push({
        accountId: account.id,
        direction: 'CREDIT',
        amount: recipient.credit,
        balanceAfter: account.currentBalance,
        sequence: index + 2,
        createdAt: input.now,
      });
    }
    const transaction = await client.ledgerTransaction.create({
      data: {
        type:
          input.type === 'WINNER_TAKES_ALL'
            ? 'MATCH_WINNER_SETTLEMENT'
            : input.type === 'DRAW_REFUND'
              ? 'MATCH_DRAW_REFUND'
              : 'MATCH_VOID_REFUND',
        assetCode: 'ARENA_POINT',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.fingerprint,
        referenceType: 'MATCH_SETTLEMENT',
        referenceId: input.matchId,
        description: 'Non-monetary match settlement',
        createdByUserId: input.actorUserId,
        postedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
        entries: {
          create: [
            {
              accountId: escrowId,
              direction: 'DEBIT',
              amount: total,
              balanceAfter: escrowAfter.currentBalance,
              sequence: 1,
              createdAt: input.now,
            },
            ...creditEntries,
          ],
        },
      },
      select: { id: true },
    });
    return { transactionId: transaction.id };
  }
  public async getEscrowBalance(matchId: string): Promise<bigint> {
    const account = await this.client().ledgerAccount.findUnique({
      where: {
        systemKey_assetCode: {
          systemKey: `match_escrow:${matchId}`,
          assetCode: 'ARENA_POINT',
        },
      },
      select: { currentBalance: true },
    });
    return account?.currentBalance ?? 0n;
  }
}
