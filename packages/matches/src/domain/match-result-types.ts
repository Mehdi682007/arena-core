import type { MatchParticipantSide, MatchRecord } from './match-types';

export interface MatchParticipantScore {
  readonly side: MatchParticipantSide;
  readonly score: number;
}
export interface MatchResultPayload {
  readonly schemaVersion: 1;
  readonly type: 'SCORE';
  readonly scores: readonly MatchParticipantScore[];
  readonly outcome: 'WIN_LOSS' | 'DRAW';
}
export type MatchResultSubmissionStatus =
  'ACTIVE' | 'WITHDRAWN' | 'SUPERSEDED' | 'CONFIRMED' | 'CONFLICTING';
export type MatchResultStatus = 'CONFIRMED' | 'CONFLICT' | 'ADMIN_RESOLVED' | 'VOIDED';
export type MatchResultConfirmationMethod = 'PARTICIPANT_AGREEMENT' | 'ADMIN_RESOLUTION';
export type MatchResultConflictReason =
  'SUBMISSIONS_DIFFER' | 'OPPONENT_DID_NOT_SUBMIT' | 'INVALID_STATE_RECOVERY';
export type MatchResultResolutionReasonCode =
  'SUBMISSION_ERROR' | 'OPERATIONAL_CORRECTION' | 'OTHER';

export interface MatchResultSubmissionRecord {
  readonly id: string;
  readonly matchId: string;
  readonly participantId: string;
  readonly submittedByUserId: string;
  readonly status: MatchResultSubmissionStatus;
  readonly resultPayload: MatchResultPayload;
  readonly submittedAt: Date;
  readonly withdrawnAt: Date | null;
  readonly supersededAt: Date | null;
  readonly version: number;
}
export interface MatchResultRecord {
  readonly id: string;
  readonly matchId: string;
  readonly status: MatchResultStatus;
  readonly resultPayload: MatchResultPayload | null;
  readonly winnerParticipantId: string | null;
  readonly loserParticipantId: string | null;
  readonly isDraw: boolean;
  readonly confirmationMethod: MatchResultConfirmationMethod | null;
  readonly conflictReason: MatchResultConflictReason | null;
  readonly confirmedAt: Date | null;
  readonly resolvedByUserId: string | null;
  readonly resolutionReasonCode: string | null;
}
export interface MatchResultContext {
  readonly match: MatchRecord;
  readonly submissions: readonly MatchResultSubmissionRecord[];
  readonly result: MatchResultRecord | null;
  readonly resultSubmissionDeadlineAt: Date | null;
  readonly resultConflictDeadlineAt: Date | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly settlementExists?: boolean;
  readonly ratingApplicationExists?: boolean;
}
export interface MatchResultSubmissionView {
  readonly submitted: boolean;
  readonly submittedAt: Date | null;
  readonly status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'CONFLICT';
}
export interface MatchResultView {
  readonly status: 'PENDING' | 'CONFIRMED' | 'CONFLICT' | 'ADMIN_RESOLVED' | 'VOIDED';
  readonly submission: MatchResultSubmissionView;
  readonly outcome?: 'WIN_LOSS' | 'DRAW';
  readonly scores?: readonly MatchParticipantScore[];
  readonly winnerSide?: MatchParticipantSide;
  readonly isDraw?: boolean;
  readonly confirmedAt?: Date;
}
export interface MatchResultOutcome {
  readonly winnerParticipantId: string | null;
  readonly loserParticipantId: string | null;
  readonly isDraw: boolean;
}
