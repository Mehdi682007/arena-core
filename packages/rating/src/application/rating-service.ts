import { createHash } from 'node:crypto';
import { calculateEloPair, type ScoredOutcome } from '../domain/elo-rating-calculator';
import { RatingError } from '../domain/rating-errors';
import type { RatingPolicy } from '../domain/rating-policy';
import type {
  ApplyMatchRatingInput,
  MatchRatingApplicationRecord,
  MatchRatingContext,
  RatingCalculationSnapshot,
} from '../domain/rating-types';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { ApplyParticipantChange, RatingRepository } from '../ports/rating-repository';
import type { RatingTransactionManager } from '../ports/rating-transaction-manager';

function fingerprint(context: MatchRatingContext, policy: RatingPolicy): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: 1,
        matchId: context.matchId,
        resultId: context.result?.id,
        resultVersion: context.result?.version,
        policyKey: policy.key,
        policyVersion: policy.version,
      }),
    )
    .digest('hex');
}

function outcomeFor(context: MatchRatingContext, participantId: string): ScoredOutcome {
  const result = context.result;
  if (!result) throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
  if (result.isDraw) {
    if (result.winnerParticipantId || result.loserParticipantId)
      throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
    return 'DRAW';
  }
  if (result.winnerParticipantId === participantId) return 'WIN';
  if (result.loserParticipantId === participantId) return 'LOSS';
  throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
}

export class RatingService {
  public constructor(
    private readonly repository: RatingRepository,
    private readonly transactions: RatingTransactionManager<RatingRepository>,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly policy: RatingPolicy,
    private readonly delaySeconds: number,
    private readonly integration?: { ratingUpdated(applicationId: string): Promise<void> },
  ) {}

  public async applyMatchRating(
    input: ApplyMatchRatingInput,
  ): Promise<MatchRatingApplicationRecord> {
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey))
      throw new RatingError('RATING_APPLICATION_IDEMPOTENCY_CONFLICT');
    const application = await this.transactions.transaction(async (repository) => {
      const context = await repository.findMatchRatingContext(input.matchId);
      if (!context) throw new RatingError('RATING_NOT_FOUND');
      const requestFingerprint = fingerprint(context, this.policy);
      const byKey = await repository.findApplicationByIdempotencyKey(input.idempotencyKey);
      if (byKey) {
        if (
          byKey.matchId === input.matchId &&
          byKey.requestFingerprint === requestFingerprint &&
          byKey.status === 'APPLIED'
        )
          return byKey;
        throw new RatingError('RATING_APPLICATION_IDEMPOTENCY_CONFLICT');
      }
      const existing = await repository.findApplicationByMatchId(input.matchId);
      if (existing) throw new RatingError('RATING_APPLICATION_ALREADY_EXISTS');
      this.assertEligible(context);
      const now = this.clock.now();
      const participants = [...context.participants].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      );
      const [participantA, participantB] = participants;
      if (!participantA || !participantB || participants.length !== 2)
        throw new RatingError('RATING_APPLICATION_PARTICIPANT_INVALID');
      const base = {
        ...context,
        initialRating: this.policy.initialRating,
        now,
      };
      const ratingA = await repository.ensurePlayerRating({
        ...base,
        id: this.ids.generate(),
        userId: participantA.userId,
      });
      const ratingB = await repository.ensurePlayerRating({
        ...base,
        id: this.ids.generate(),
        userId: participantB.userId,
      });
      const outcomeA = outcomeFor(context, participantA.id);
      const outcomeB = outcomeFor(context, participantB.id);
      const calculated = calculateEloPair(
        this.policy,
        { rating: ratingA.rating, matchesPlayed: ratingA.matchesPlayed, outcome: outcomeA },
        { rating: ratingB.rating, matchesPlayed: ratingB.matchesPlayed, outcome: outcomeB },
      );
      const change = (
        rating: typeof ratingA,
        opponentUserId: string,
        outcome: ScoredOutcome,
        value: typeof calculated.participantA,
        opponentBefore: number,
      ): ApplyParticipantChange => {
        const snapshot: RatingCalculationSnapshot = {
          schemaVersion: 1,
          policy: {
            key: this.policy.key,
            version: this.policy.version,
            kFactor: value.kFactor,
            divisor: 400,
          },
          participant: {
            ratingBefore: value.ratingBefore,
            expectedScore: value.expectedScore,
            actualScore: value.actualScore,
            ratingDelta: value.ratingDelta,
            ratingAfter: value.ratingAfter,
          },
          opponent: { ratingBefore: opponentBefore },
        };
        return {
          id: this.ids.generate(),
          rating,
          opponentUserId,
          outcome,
          ratingBefore: value.ratingBefore,
          ratingAfter: value.ratingAfter,
          ratingDelta: value.ratingDelta,
          opponentRatingBefore: opponentBefore,
          snapshot,
        };
      };
      return repository.applyRatingChanges({
        applicationId: this.ids.generate(),
        context,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        provisionalMatchCount: this.policy.provisionalMatchCount,
        changes: [
          change(ratingA, ratingB.userId, outcomeA, calculated.participantA, ratingB.rating),
          change(ratingB, ratingA.userId, outcomeB, calculated.participantB, ratingA.rating),
        ],
        now,
      });
    });
    await this.integration?.ratingUpdated(application.id);
    return application;
  }

  private assertEligible(context: MatchRatingContext): void {
    if (context.matchStatus !== 'COMPLETED')
      throw new RatingError('RATING_APPLICATION_NOT_ELIGIBLE');
    if (context.activeDispute) throw new RatingError('RATING_APPLICATION_ACTIVE_DISPUTE');
    const result = context.result;
    if (!result || !['CONFIRMED', 'ADMIN_RESOLVED'].includes(result.status))
      throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
    if (context.participants.length !== 2)
      throw new RatingError('RATING_APPLICATION_PARTICIPANT_INVALID');
    const immediate = result.status === 'ADMIN_RESOLVED' && context.resolvedDisputeAt !== null;
    const base = context.completedAt;
    if (!base) throw new RatingError('RATING_APPLICATION_NOT_ELIGIBLE');
    const eligibleAt = new Date(base.getTime() + this.delaySeconds * 1000);
    if (!immediate && this.clock.now() < eligibleAt)
      throw new RatingError('RATING_APPLICATION_DELAY_NOT_ELAPSED');
    outcomeFor(context, context.participants[0]?.id ?? '');
    outcomeFor(context, context.participants[1]?.id ?? '');
  }

  public getMyRatings(userId: string) {
    return this.repository.getMyRatings(userId);
  }

  public getMyRating(userId: string, gameKey: string, modeKey: string) {
    return this.repository.getMyRating(userId, gameKey, modeKey);
  }

  public getMyHistory(
    userId: string,
    gameKey: string,
    modeKey: string,
    cursor: string | undefined,
    limit: number,
  ) {
    return this.repository.getMyRatingHistory(userId, gameKey, modeKey, cursor, limit);
  }
}
