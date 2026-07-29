import type {
  AdjustmentReason,
  LedgerDirection,
  LedgerItemRecord,
  LedgerTransactionType,
  PostedTransaction,
  WalletRecord,
  WalletReconciliationResult,
} from '../domain/wallet-types';

export interface PostLedgerInput {
  readonly userId: string;
  readonly actorUserId: string;
  readonly type: Exclude<LedgerTransactionType, 'REVERSAL'>;
  readonly direction: LedgerDirection;
  readonly amount: bigint;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly reasonCode: AdjustmentReason;
  readonly note?: string;
  readonly now: Date;
}
export interface ReverseLedgerInput {
  readonly transactionId: string;
  readonly actorUserId: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly reasonCode: AdjustmentReason;
  readonly note?: string;
  readonly now: Date;
}
export interface WalletRepository {
  ensureWallet(userId: string, now: Date): Promise<WalletRecord>;
  getWallet(userId: string): Promise<WalletRecord | null>;
  listEntries(
    userId: string,
    limit: number,
    cursor?: string,
    type?: LedgerTransactionType,
    direction?: LedgerDirection,
  ): Promise<readonly LedgerItemRecord[]>;
  findByIdempotencyKey(key: string): Promise<PostedTransaction | null>;
  post(input: PostLedgerInput): Promise<PostedTransaction>;
  findTransaction(transactionId: string): Promise<PostedTransaction | null>;
  reverse(input: ReverseLedgerInput): Promise<PostedTransaction>;
  reconcile(userId: string, actorUserId: string, now: Date): Promise<WalletReconciliationResult>;
}
