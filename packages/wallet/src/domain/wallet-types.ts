export const ARENA_POINT = {
  code: 'ARENA_POINT',
  name: 'Arena Point',
  monetary: false,
  withdrawable: false,
} as const;
export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type LedgerDirection = 'DEBIT' | 'CREDIT';
export type LedgerTransactionType =
  | 'ISSUANCE'
  | 'ADMIN_ADJUSTMENT'
  | 'REVERSAL'
  | 'MATCH_ENTRY_RESERVATION'
  | 'MATCH_ENTRY_REFUND'
  | 'MATCH_WINNER_SETTLEMENT'
  | 'MATCH_DRAW_REFUND'
  | 'MATCH_VOID_REFUND';
export type AdjustmentReason =
  'FOUNDATION_TEST' | 'PROMOTIONAL_GRANT' | 'OPERATIONAL_CORRECTION' | 'OTHER';
export interface WalletRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: WalletStatus;
  readonly balance: bigint;
  readonly updatedAt: Date;
}
export interface LedgerItemRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly type: LedgerTransactionType;
  readonly direction: LedgerDirection;
  readonly amount: bigint;
  readonly balanceAfter: bigint;
  readonly description: string | null;
  readonly createdAt: Date;
}
export interface PostedTransaction {
  readonly id: string;
  readonly userId: string;
  readonly type: LedgerTransactionType;
  readonly status: 'POSTED' | 'REVERSED';
  readonly direction: LedgerDirection;
  readonly amount: bigint;
  readonly fingerprint: string;
  readonly balanceAfter: bigint;
  readonly reversedById: string | null;
}
export interface WalletView {
  readonly id: string;
  readonly status: WalletStatus;
  readonly asset: typeof ARENA_POINT;
  readonly balance: string;
  readonly updatedAt: Date;
}
export interface WalletLedgerItemView {
  readonly id: string;
  readonly transactionId: string;
  readonly type: LedgerTransactionType;
  readonly direction: LedgerDirection;
  readonly amount: string;
  readonly balanceAfter: string;
  readonly description: string | null;
  readonly createdAt: Date;
}
export interface WalletReconciliationResult {
  readonly consistent: boolean;
  readonly storedBalance: bigint;
  readonly derivedBalance: bigint;
  readonly difference: bigint;
}
