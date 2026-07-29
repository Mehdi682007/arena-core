export type MatchStatus =
  | 'CREATED'
  | 'AWAITING_READY'
  | 'READY'
  | 'IN_PROGRESS'
  | 'AWAITING_RESULT'
  | 'RESULT_CONFLICT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'VOIDED';
export type MatchParticipantSide = 'SIDE_A' | 'SIDE_B';
export type MatchParticipantStatus = 'PENDING' | 'READY' | 'CANCELLED';
export type MatchAuditAction =
  | 'CREATED'
  | 'USER_CANCELLED'
  | 'EXPIRED'
  | 'ADMIN_VOIDED'
  | 'MATCH_STARTED'
  | 'RESULT_SUBMITTED'
  | 'RESULT_WITHDRAWN'
  | 'RESULT_CONFIRMED'
  | 'RESULT_CONFLICTED'
  | 'RESULT_ADMIN_RESOLVED'
  | 'RESULT_SUBMISSION_EXPIRED'
  | 'EVIDENCE_SUBMITTED'
  | 'EVIDENCE_WITHDRAWN'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESPONDED'
  | 'DISPUTE_CANCELLED'
  | 'DISPUTE_ASSIGNED'
  | 'DISPUTE_REVIEW_STARTED'
  | 'DISPUTE_RESOLVED'
  | 'DISPUTE_RESPONSE_EXPIRED';
export type MatchVoidReasonCode =
  | 'INVALID_PROPOSAL_STATE'
  | 'ACCOUNT_INVALIDATED'
  | 'CATALOG_CONFIGURATION_INVALID'
  | 'DUPLICATE_MATCH'
  | 'OPERATIONAL_ERROR'
  | 'OTHER';

export interface SnapshotEnvelope<T> {
  readonly schemaVersion: 1;
  readonly data: Readonly<T>;
}
export interface GameSnapshot {
  readonly gameId: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
}
export interface ModeSnapshot {
  readonly gameModeId: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly teamSizeMin: number;
  readonly teamSizeMax: number;
  readonly participantCountMin: number;
  readonly participantCountMax: number;
}
export interface RulesetSnapshot {
  readonly gameRulesetId: string;
  readonly key: string;
  readonly name: string;
  readonly version: number;
  readonly configuration: unknown;
  readonly publishedAt: string;
}
export interface CrossplaySnapshot {
  readonly crossplayGroupId: string;
  readonly key: string;
  readonly name: string;
}
export interface ParticipantSnapshot {
  readonly userId: string;
  readonly userGameAccountId: string;
  readonly gamePlatformId: string;
  readonly platformKey: string;
  readonly platformName: string;
  readonly displayHandle: string;
}
export interface MatchParticipant {
  readonly id: string;
  readonly matchId: string;
  readonly userId: string;
  readonly userGameAccountId: string;
  readonly gameId: string;
  readonly gamePlatformId: string;
  readonly side: MatchParticipantSide;
  readonly status: MatchParticipantStatus;
  readonly snapshot: SnapshotEnvelope<ParticipantSnapshot>;
  readonly readyAt: Date | null;
}
export interface MatchRecord {
  readonly id: string;
  readonly matchmakingProposalId: string;
  readonly gameId: string;
  readonly gameModeId: string;
  readonly gameRulesetId: string;
  readonly crossplayGroupId: string;
  readonly status: MatchStatus;
  readonly gameSnapshot: SnapshotEnvelope<GameSnapshot>;
  readonly modeSnapshot: SnapshotEnvelope<ModeSnapshot>;
  readonly rulesetSnapshot: SnapshotEnvelope<RulesetSnapshot>;
  readonly crossplaySnapshot: SnapshotEnvelope<CrossplaySnapshot>;
  readonly participants: readonly MatchParticipant[];
  readonly readyDeadlineAt: Date;
  readonly cancelledAt: Date | null;
  readonly voidedAt: Date | null;
  readonly startedAt: Date | null;
  readonly resultSubmissionDeadlineAt: Date | null;
  readonly resultConflictDeadlineAt: Date | null;
  readonly completedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
}
export interface MatchParticipantView {
  readonly side: MatchParticipantSide;
  readonly displayHandle: string;
  readonly platform: Readonly<{ key: string; name: string }>;
  readonly ready: boolean;
  readonly isCurrentUser: boolean;
}
export interface MatchView {
  readonly id: string;
  readonly status: MatchStatus;
  readonly game: GameSnapshot;
  readonly mode: ModeSnapshot;
  readonly ruleset: Omit<RulesetSnapshot, 'gameRulesetId' | 'publishedAt'>;
  readonly crossplay: Omit<CrossplaySnapshot, 'crossplayGroupId'>;
  readonly participants: readonly MatchParticipantView[];
  readonly readyDeadlineAt: Date;
  readonly startedAt: Date | null;
  readonly resultSubmissionDeadlineAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}
export interface AcceptedProposalContext {
  readonly proposalId: string;
  readonly proposalStatus: 'ACCEPTED' | 'OTHER';
  readonly game: GameSnapshot;
  readonly mode: ModeSnapshot;
  readonly ruleset: RulesetSnapshot & {
    readonly status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  };
  readonly crossplay: CrossplaySnapshot;
  readonly participants: readonly [
    ParticipantSnapshot & { readonly accountVerified: boolean; readonly requestMatched: boolean },
    ParticipantSnapshot & { readonly accountVerified: boolean; readonly requestMatched: boolean },
  ];
}
export interface MatchAuditEvent {
  readonly id: string;
  readonly matchId: string;
  readonly actorUserId: string | null;
  readonly action: MatchAuditAction;
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
}
