import { MatchFinanceError } from '../domain/match-entry-errors';
import { reservationFingerprint } from '../domain/reservation-policies';
import type {
  MatchEntryReservationView,
  MatchFinanceRefundReason,
  MatchEscrowReconciliationResult,
} from '../domain/match-entry-types';
import { toReservationView } from '../domain/match-entry-policies';
import type { Clock } from '../ports/clock';
import type { MatchFinanceRepository } from '../ports/match-finance-repository';
import type { MatchFinanceTransactionManager } from '../ports/match-finance-transaction-manager';
import type { WalletLedgerPort } from '../ports/wallet-ledger-port';

export class AdminMatchFinanceService {
  public constructor(
    private readonly repository: MatchFinanceRepository,
    private readonly ledger: WalletLedgerPort,
    private readonly transactions: MatchFinanceTransactionManager,
    private readonly clock: Clock,
  ) {}
  public async listMatch(
    matchId: string,
    limit = 100,
  ): Promise<readonly MatchEntryReservationView[]> {
    return (await this.repository.listMatch(matchId, Math.min(Math.max(limit, 1), 100))).map(
      toReservationView,
    );
  }
  public async release(matchId: string): Promise<readonly MatchEntryReservationView[]> {
    return (await this.repository.releaseMatch(matchId, this.clock.now())).map(toReservationView);
  }
  public async refund(input: {
    matchId: string;
    actorUserId: string;
    idempotencyKey: string;
    reasonCode: MatchFinanceRefundReason;
    note?: string;
    limit?: number;
  }): Promise<readonly MatchEntryReservationView[]> {
    void input.note;
    return this.transactions.transaction(async () => {
      const status = await this.repository.getMatchStatus(input.matchId);
      const operational = input.reasonCode === 'OPERATIONAL_RECOVERY';
      if (!operational && !['CANCELLED', 'EXPIRED', 'VOIDED'].includes(status ?? ''))
        throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_REFUND_NOT_ALLOWED');
      const rows = await this.repository.listRefundable(
        input.matchId,
        Math.min(Math.max(input.limit ?? 10, 1), 100),
      );
      const results = [];
      for (const reservation of rows) {
        if (reservation.status !== 'RESERVED')
          throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_REFUND_NOT_ALLOWED');
        const fingerprint = reservationFingerprint({
          matchId: reservation.matchId,
          participantId: reservation.participantId,
          userId: reservation.userId,
          assetCode: 'ARENA_POINT',
          amount: reservation.amount,
          operation: 'REFUND',
        });
        const posting = await this.ledger.refund({
          matchId: reservation.matchId,
          participantId: reservation.participantId,
          reservationId: reservation.id,
          userId: reservation.userId,
          actorUserId: input.actorUserId,
          amount: reservation.amount,
          idempotencyKey: `ledger:${input.idempotencyKey}:${reservation.id}`,
          fingerprint,
          now: this.clock.now(),
        });
        results.push(
          await this.repository.markRefunded(
            reservation.id,
            posting.transactionId,
            input.reasonCode,
            input.actorUserId,
            this.clock.now(),
          ),
        );
      }
      return results.map(toReservationView);
    });
  }
  public async reconcile(matchId: string): Promise<MatchEscrowReconciliationResult> {
    const rows = await this.repository.listMatch(matchId, 100);
    const expectedBalance = rows
      .filter((row) => row.status === 'RESERVED' || row.status === 'RELEASED')
      .reduce((sum, row) => sum + row.amount, 0n);
    return this.ledger.reconcileMatchEscrow(matchId, expectedBalance, rows.length);
  }
}
