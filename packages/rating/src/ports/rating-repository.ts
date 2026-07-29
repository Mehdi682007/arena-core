import type { LeaderboardPage, LeaderboardQuery, RatingScope } from '../domain/leaderboard-types';
import type {
  MatchRatingApplicationRecord,
  MatchRatingContext,
  MyRatingView,
  PlayerRatingRecord,
  RatingCalculationSnapshot,
  RatingChangeRecord,
  RatingHistoryItemView,
  RatingOutcome,
} from '../domain/rating-types';

export interface EnsurePlayerRatingInput extends RatingScope {
  readonly id: string;
  readonly userId: string;
  readonly initialRating: number;
  readonly now: Date;
}

export interface ApplyParticipantChange {
  readonly id: string;
  readonly rating: PlayerRatingRecord;
  readonly opponentUserId: string;
  readonly outcome: Exclude<RatingOutcome, 'VOID'>;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDelta: number;
  readonly opponentRatingBefore: number;
  readonly snapshot: RatingCalculationSnapshot;
}

export interface PersistRatingApplicationInput {
  readonly applicationId: string;
  readonly context: MatchRatingContext;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly actorUserId?: string;
  readonly provisionalMatchCount: number;
  readonly changes: readonly [ApplyParticipantChange, ApplyParticipantChange];
  readonly now: Date;
}

export interface PlayerRatingReconciliationData {
  readonly rating: PlayerRatingRecord;
  readonly changes: readonly RatingChangeRecord[];
}

export interface RatingRepository {
  findMatchRatingContext(matchId: string): Promise<MatchRatingContext | null>;
  findApplicationByMatchId(matchId: string): Promise<MatchRatingApplicationRecord | null>;
  findApplicationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<MatchRatingApplicationRecord | null>;
  ensurePlayerRating(input: EnsurePlayerRatingInput): Promise<PlayerRatingRecord>;
  applyRatingChanges(input: PersistRatingApplicationInput): Promise<MatchRatingApplicationRecord>;
  getMyRatings(userId: string): Promise<readonly MyRatingView[]>;
  getMyRating(userId: string, gameKey: string, modeKey: string): Promise<MyRatingView | null>;
  getMyRatingHistory(
    userId: string,
    gameKey: string,
    modeKey: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Readonly<{ items: readonly RatingHistoryItemView[]; nextCursor: string | null }>>;
  listLeaderboard(query: LeaderboardQuery): Promise<LeaderboardPage>;
  getMyRank(userId: string, scope: RatingScope, minimumMatches: number): Promise<number | null>;
  resolveScope(
    gameKey: string,
    modeKey: string,
    crossplayGroupKey?: string,
  ): Promise<RatingScope | null>;
  listEligibleMatches(now: Date, limit: number): Promise<readonly string[]>;
  listFailedApplications(limit: number): Promise<readonly MatchRatingApplicationRecord[]>;
  reconcilePlayerRating(playerRatingId: string): Promise<PlayerRatingReconciliationData | null>;
  listAdmin(limit: number): Promise<readonly PlayerRatingRecord[]>;
  listForAdminUser(userId: string): Promise<readonly PlayerRatingRecord[]>;
}
