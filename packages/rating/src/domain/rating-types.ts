import type { RatingScope } from './leaderboard-types';

export type RatingOutcome = 'WIN' | 'LOSS' | 'DRAW' | 'VOID';
export type RatingApplicationStatus = 'APPLIED' | 'FAILED' | 'REVERSED';

export interface PlayerRatingRecord extends RatingScope {
  readonly id: string;
  readonly userId: string;
  readonly rating: number;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly provisionalMatchesPlayed: number;
  readonly highestRating: number;
  readonly lowestRating: number;
  readonly lastMatchId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MatchRatingParticipant {
  readonly id: string;
  readonly userId: string;
}

export interface MatchRatingContext extends RatingScope {
  readonly matchId: string;
  readonly matchStatus: string;
  readonly completedAt: Date | null;
  readonly settlementEligibleAt: Date | null;
  readonly result: Readonly<{
    id: string;
    status: string;
    version: number;
    winnerParticipantId: string | null;
    loserParticipantId: string | null;
    isDraw: boolean;
    confirmedAt: Date | null;
  }> | null;
  readonly participants: readonly MatchRatingParticipant[];
  readonly activeDispute: boolean;
  readonly resolvedDisputeAt: Date | null;
}

export interface RatingCalculationSnapshot {
  readonly schemaVersion: 1;
  readonly policy: Readonly<{ key: 'ELO'; version: 1; kFactor: number; divisor: 400 }>;
  readonly participant: Readonly<{
    ratingBefore: number;
    expectedScore: number;
    actualScore: number;
    ratingDelta: number;
    ratingAfter: number;
  }>;
  readonly opponent: Readonly<{ ratingBefore: number }>;
}

export interface RatingChangeRecord {
  readonly id: string;
  readonly playerRatingId: string;
  readonly matchId: string;
  readonly matchResultId: string;
  readonly userId: string;
  readonly opponentUserId: string;
  readonly outcome: RatingOutcome;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDelta: number;
  readonly opponentRatingBefore: number;
  readonly policyKey: 'ELO';
  readonly policyVersion: 1;
  readonly calculationSnapshot: RatingCalculationSnapshot;
  readonly appliedAt: Date;
  readonly reversedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
}

export interface MatchRatingApplicationRecord {
  readonly id: string;
  readonly matchId: string;
  readonly matchResultId: string;
  readonly status: RatingApplicationStatus;
  readonly policyKey: 'ELO';
  readonly policyVersion: 1;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly actorUserId: string | null;
  readonly appliedAt: Date | null;
  readonly failedAt: Date | null;
  readonly failureCode: string | null;
  readonly version: number;
}

export interface ApplyMatchRatingInput {
  readonly matchId: string;
  readonly idempotencyKey: string;
  readonly operation: 'SYSTEM' | 'ADMIN_RETRY';
  readonly actorUserId?: string;
}

export interface MyRatingView {
  readonly game: Readonly<{ key: string; name: string }>;
  readonly mode: Readonly<{ key: string; name: string }>;
  readonly crossplayGroup: Readonly<{ key: string; name: string }>;
  readonly rating: number;
  readonly rank: number | null;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly provisional: boolean;
  readonly highestRating: number;
}

export interface RatingHistoryItemView {
  readonly matchId: string;
  readonly outcome: Exclude<RatingOutcome, 'VOID'>;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDelta: number;
  readonly appliedAt: Date;
}
