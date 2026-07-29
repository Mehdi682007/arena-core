import { MatchFinanceError } from '../domain/match-entry-errors';
import { parseRequirement, toReservationView } from '../domain/match-entry-policies';
import { reservationFingerprint } from '../domain/reservation-policies';
import type { MatchEntryReservationView } from '../domain/match-entry-types';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { MatchFinanceRepository } from '../ports/match-finance-repository';
import type { MatchFinanceTransactionManager } from '../ports/match-finance-transaction-manager';
import type { WalletLedgerPort } from '../ports/wallet-ledger-port';

export class MatchEntryReservationService {
  public constructor(
    private readonly repository: MatchFinanceRepository,
    private readonly ledger: WalletLedgerPort,
    private readonly transactions: MatchFinanceTransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly ttlSeconds = 300,
  ) {}

  public async reserve(input: {
    matchId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<MatchEntryReservationView> {
    return this.transactions.transaction(async () => {
      const context = await this.repository.findContext(input.userId, input.matchId);
      if (!context) throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_PARTICIPANT_INVALID');
      if (!['CREATED', 'AWAITING_READY'].includes(context.matchStatus))
        throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_MATCH_INVALID');
      const now = this.clock.now();
      if (context.readyDeadlineAt <= now)
        throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_EXPIRED');
      const requirement = parseRequirement(context.rulesetConfiguration);
      const amount = BigInt(requirement.amountPerParticipant);
      const fingerprint = reservationFingerprint({
        matchId: context.matchId,
        participantId: context.participantId,
        userId: context.userId,
        assetCode: 'ARENA_POINT',
        amount,
        operation: 'RESERVE',
      });
      const keyed = await this.repository.findByIdempotencyKey(input.idempotencyKey);
      if (keyed) {
        if (keyed.requestFingerprint !== fingerprint)
          throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_IDEMPOTENCY_CONFLICT');
        return toReservationView(keyed);
      }
      const existing = await this.repository.findByParticipant(
        context.matchId,
        context.participantId,
      );
      if (existing) return toReservationView(existing);
      const expiresAt = new Date(
        Math.min(context.readyDeadlineAt.getTime(), now.getTime() + this.ttlSeconds * 1000),
      );
      let posting = null;
      if (requirement.required) {
        posting = await this.ledger.reserve({
          matchId: context.matchId,
          participantId: context.participantId,
          userId: context.userId,
          amount,
          idempotencyKey: `ledger:${input.idempotencyKey}`,
          fingerprint,
          now,
        });
      }
      const record = await this.repository.create({
        id: this.ids.generate(),
        context,
        requirement,
        amount,
        status: requirement.required ? 'RESERVED' : 'NOT_REQUIRED',
        walletId: posting?.walletId ?? null,
        ledgerAccountId: posting?.userAccountId ?? null,
        escrowAccountId: posting?.escrowAccountId ?? null,
        ledgerTransactionId: posting?.transactionId ?? null,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        now,
        expiresAt,
      });
      return toReservationView(record);
    });
  }

  public async getMine(userId: string, matchId: string): Promise<MatchEntryReservationView> {
    const record = await this.repository.findMine(userId, matchId);
    if (!record) throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_NOT_FOUND');
    return toReservationView(record);
  }

  public async listMine(userId: string, limit = 50): Promise<readonly MatchEntryReservationView[]> {
    return (await this.repository.listMine(userId, Math.min(Math.max(limit, 1), 100))).map(
      toReservationView,
    );
  }
}
