export type MatchSettlementStatus = 'PENDING' | 'SETTLED' | 'REFUNDED' | 'VOIDED' | 'FAILED';
export type MatchSettlementType =
  'WINNER_TAKES_ALL' | 'DRAW_REFUND' | 'VOID_REFUND' | 'ADMIN_CORRECTION';
export type MatchEntrySettlementOutcome =
  'WINNER_CREDITED' | 'LOSER_CONTRIBUTED' | 'DRAW_REFUNDED' | 'VOID_REFUNDED';
export type MatchSettlementIneligibilityReason =
  | 'MATCH_NOT_FINAL'
  | 'MATCH_VOID_STATE_INVALID'
  | 'RESULT_NOT_FINAL'
  | 'ACTIVE_DISPUTE_EXISTS'
  | 'SETTLEMENT_ALREADY_EXISTS'
  | 'SETTLEMENT_DELAY_NOT_ELAPSED'
  | 'RESERVATION_NOT_RELEASED'
  | 'RESERVATION_ALREADY_REFUNDED'
  | 'ESCROW_BALANCE_MISMATCH'
  | 'WINNER_NOT_PARTICIPANT'
  | 'PARTICIPANT_COUNT_INVALID'
  | 'ASSET_MISMATCH';

export interface MatchSettlementReservation {
  readonly id: string;
  readonly participantId: string;
  readonly userId: string;
  readonly ledgerAccountId: string | null;
  readonly escrowAccountId: string | null;
  readonly assetCode: string;
  readonly amount: bigint;
  readonly status: string;
}
export interface MatchSettlementContext {
  readonly matchId: string;
  readonly matchStatus: string;
  readonly completedAt: Date | null;
  readonly settlementEligibleAt: Date | null;
  readonly resultId: string | null;
  readonly resultStatus: string | null;
  readonly resultVersion: number | null;
  readonly winnerParticipantId: string | null;
  readonly isDraw: boolean;
  readonly terminalDisputeId: string | null;
  readonly terminalDisputeResolvedAt: Date | null;
  readonly activeDispute: boolean;
  readonly reservations: readonly MatchSettlementReservation[];
  readonly escrowBalance: bigint;
  readonly settlementExists: boolean;
}
export interface SettlementEligibility {
  readonly eligible: boolean;
  readonly type: Exclude<MatchSettlementType, 'ADMIN_CORRECTION'> | null;
  readonly reasons: readonly MatchSettlementIneligibilityReason[];
}
export interface MatchSettlementRecord {
  readonly id: string;
  readonly matchId: string;
  readonly status: MatchSettlementStatus;
  readonly type: MatchSettlementType;
  readonly assetCode: 'ARENA_POINT';
  readonly totalEscrowAmount: bigint;
  readonly distributedAmount: bigint;
  readonly refundedAmount: bigint;
  readonly retainedAmount: bigint;
  readonly winnerParticipantId: string | null;
  readonly resultId: string | null;
  readonly disputeId: string | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly settlementTransactionId: string | null;
  readonly settledAt: Date | null;
}
export interface MatchSettlementView {
  readonly matchId: string;
  readonly status: MatchSettlementStatus;
  readonly type: MatchSettlementType | null;
  readonly asset: {
    readonly code: 'ARENA_POINT';
    readonly monetary: false;
    readonly withdrawable: false;
  };
  readonly totalAmount: string;
  readonly receivedAmount: string;
  readonly settledAt: Date | null;
}
