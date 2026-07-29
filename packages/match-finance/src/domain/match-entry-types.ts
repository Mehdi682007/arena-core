export const MATCH_ENTRY_ASSET = {
  code: 'ARENA_POINT',
  monetary: false,
  withdrawable: false,
} as const;

export type MatchEntryReservationStatus =
  | 'NOT_REQUIRED'
  | 'RESERVED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'SETTLED';

export type MatchFinanceMatchStatus =
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

export interface MatchEntryRequirementSnapshot {
  readonly schemaVersion: 1;
  readonly assetCode: 'ARENA_POINT';
  readonly amountPerParticipant: string;
  readonly required: boolean;
}

export interface MatchEntryReservationSnapshot {
  readonly schemaVersion: 1;
  readonly assetCode: 'ARENA_POINT';
  readonly amount: string;
  readonly required: boolean;
  readonly matchId: string;
  readonly participantSide: 'SIDE_A' | 'SIDE_B';
}

export interface MatchFinanceContext {
  readonly matchId: string;
  readonly matchStatus: MatchFinanceMatchStatus;
  readonly participantId: string;
  readonly participantSide: 'SIDE_A' | 'SIDE_B';
  readonly participantStatus: 'PENDING' | 'READY' | 'CANCELLED';
  readonly userId: string;
  readonly rulesetConfiguration: unknown;
  readonly readyDeadlineAt: Date;
}

export interface MatchEntryReservationRecord {
  readonly id: string;
  readonly matchId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly assetCode: 'ARENA_POINT';
  readonly amount: bigint;
  readonly status: MatchEntryReservationStatus;
  readonly requirementSnapshot: MatchEntryRequirementSnapshot;
  readonly reservationSnapshot: MatchEntryReservationSnapshot;
  readonly ledgerTransactionId: string | null;
  readonly refundLedgerTransactionId: string | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly reservedAt: Date | null;
  readonly releasedAt: Date | null;
  readonly refundedAt: Date | null;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
}

export interface MatchEntryReservationView {
  readonly matchId: string;
  readonly status: MatchEntryReservationStatus;
  readonly asset: typeof MATCH_ENTRY_ASSET;
  readonly amount: string;
  readonly reservedAt: Date | null;
  readonly releasedAt: Date | null;
  readonly refundedAt: Date | null;
}

export type MatchFinanceRefundReason =
  | 'MATCH_CANCELLED'
  | 'MATCH_EXPIRED'
  | 'MATCH_VOIDED_BEFORE_START'
  | 'OPERATIONAL_RECOVERY'
  | 'OTHER';

export interface MatchEscrowReconciliationResult {
  readonly consistent: boolean;
  readonly escrowBalance: bigint;
  readonly expectedBalance: bigint;
  readonly difference: bigint;
  readonly reservationCount: number;
}
