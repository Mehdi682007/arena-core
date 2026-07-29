import type { MatchEvidenceRecord } from './match-evidence-types';
import type { MatchResultContext, MatchResultPayload } from './match-result-types';

export type MatchDisputeStatus =
  'OPEN' | 'AWAITING_RESPONSE' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type MatchDisputeReasonCode =
  | 'SCORE_MISMATCH'
  | 'WRONG_WINNER'
  | 'OPPONENT_NO_SHOW'
  | 'OPPONENT_DISCONNECTED'
  | 'INVALID_RESULT_SUBMISSION'
  | 'RULESET_VIOLATION'
  | 'ACCOUNT_IDENTITY_ISSUE'
  | 'OTHER';
export type RequestedOutcome =
  'KEEP_CURRENT_RESULT' | 'REVERSE_WINNER' | 'CORRECT_SCORE' | 'VOID_MATCH';
export type DisputeResolutionType =
  'UPHOLD_RESULT' | 'CORRECT_RESULT' | 'VOID_MATCH' | 'REJECT_DISPUTE';
export interface MatchDisputeClaimPayload {
  readonly schemaVersion: 1;
  readonly statement: string;
  readonly requestedOutcome: RequestedOutcome;
  readonly proposedResult?: MatchResultPayload;
  readonly evidenceIds: readonly string[];
}
export interface MatchDisputeResultSnapshot {
  readonly schemaVersion: 1;
  readonly matchStatus: string;
  readonly resultStatus: string | null;
  readonly resultPayload: MatchResultPayload | null;
  readonly confirmationMethod: string | null;
  readonly confirmedAt: string | null;
  readonly submissions: readonly { side: 'SIDE_A' | 'SIDE_B'; status: string }[];
}
export interface MatchDisputeResponseRecord {
  readonly id: string;
  readonly disputeId: string;
  readonly participantId: string;
  readonly submittedByUserId: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly submittedAt: Date;
}
export interface MatchDisputeRecord {
  readonly id: string;
  readonly matchId: string;
  readonly openedByParticipantId: string;
  readonly openedByUserId: string;
  readonly status: MatchDisputeStatus;
  readonly reasonCode: MatchDisputeReasonCode;
  readonly claimPayload: MatchDisputeClaimPayload;
  readonly resultSnapshot: MatchDisputeResultSnapshot;
  readonly responseDeadlineAt: Date;
  readonly reviewDeadlineAt: Date;
  readonly assignedReviewerUserId: string | null;
  readonly assignedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly resolutionType: DisputeResolutionType | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly response: MatchDisputeResponseRecord | null;
}
export interface MatchDisputeView {
  readonly id: string;
  readonly status: Exclude<MatchDisputeStatus, 'OPEN'>;
  readonly reasonCode: MatchDisputeReasonCode;
  readonly requestedOutcome: RequestedOutcome;
  readonly statement: string;
  readonly hasResponse: boolean;
  readonly responseSubmittedAt?: Date;
  readonly responseDeadlineAt: Date;
  readonly resolutionType: DisputeResolutionType | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}
export interface MatchDisputeContext {
  readonly resultContext: MatchResultContext;
  readonly evidence: readonly MatchEvidenceRecord[];
  readonly disputes: readonly MatchDisputeRecord[];
  readonly settlementExists?: boolean;
  readonly ratingApplicationExists?: boolean;
}
