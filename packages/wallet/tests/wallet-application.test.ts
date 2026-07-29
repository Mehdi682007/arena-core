import { describe, expect, it, vi } from 'vitest';
import { WalletLedgerService } from '../src/application/wallet-ledger-service';
import { WalletQueryService } from '../src/application/wallet-query-service';
import { WalletReconciliationService } from '../src/application/wallet-reconciliation-service';
import { WalletError } from '../src/domain/wallet-errors';
import type { PostedTransaction, WalletRecord } from '../src/domain/wallet-types';
import type {
  PostLedgerInput,
  ReverseLedgerInput,
  WalletRepository,
} from '../src/ports/wallet-repository';

const now = new Date('2026-01-01T00:00:00Z');
const clock = { now: () => now };
const posted: PostedTransaction = {
  id: 'transaction-1',
  userId: 'user-1',
  type: 'ISSUANCE',
  status: 'POSTED',
  direction: 'CREDIT',
  amount: 10n,
  fingerprint: '',
  balanceAfter: 10n,
  reversedById: null,
};
function repository(): WalletRepository {
  return {
    ensureWallet: vi.fn(async (userId: string): Promise<WalletRecord> => ({
      id: 'wallet-1',
      userId,
      status: 'ACTIVE',
      balance: 10n,
      updatedAt: now,
    })),
    getWallet: vi.fn(async () => null),
    listEntries: vi.fn(async () => []),
    findByIdempotencyKey: vi.fn(async () => null),
    post: vi.fn(async (input: PostLedgerInput): Promise<PostedTransaction> => ({
      ...posted,
      fingerprint: input.fingerprint,
    })),
    findTransaction: vi.fn(async () => posted),
    reverse: vi.fn(async (input: ReverseLedgerInput): Promise<PostedTransaction> => ({
      ...posted,
      id: 'reversal-1',
      type: 'REVERSAL',
      direction: 'DEBIT',
      fingerprint: input.fingerprint,
      balanceAfter: 0n,
    })),
    reconcile: vi.fn(async () => ({
      consistent: true,
      storedBalance: 10n,
      derivedBalance: 10n,
      difference: 0n,
    })),
  };
}
const issue = {
  userId: 'user-1',
  actorUserId: 'admin-1',
  operation: 'ISSUANCE' as const,
  direction: 'CREDIT' as const,
  amount: 10n,
  idempotencyKey: 'wallet:test:1001',
  reasonCode: 'FOUNDATION_TEST' as const,
};

describe('wallet application services', () => {
  it('posts issuance with a deterministic fingerprint and clock', async () => {
    const repo = repository();
    const result = await new WalletLedgerService(repo, clock).post(issue);
    expect(result.status).toBe('POSTED');
    expect(repo.post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ISSUANCE',
        amount: 10n,
        now,
        fingerprint: expect.any(String),
      }),
    );
  });
  it('returns the original result for an exact idempotent retry', async () => {
    const repo = repository();
    const service = new WalletLedgerService(repo, clock);
    const first = await service.post(issue);
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValue(first);
    expect(await service.post(issue)).toBe(first);
    expect(repo.post).toHaveBeenCalledTimes(1);
  });
  it('rejects idempotency reuse with a different payload or target', async () => {
    const repo = repository();
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValue({ ...posted, fingerprint: 'different' });
    await expect(new WalletLedgerService(repo, clock).post(issue)).rejects.toMatchObject({
      code: 'WALLET_IDEMPOTENCY_CONFLICT',
    });
  });
  it('creates inverse reversal input and rejects already reversed transactions', async () => {
    const repo = repository();
    const service = new WalletLedgerService(repo, clock);
    const result = await service.reverse({
      transactionId: posted.id,
      actorUserId: 'admin-1',
      idempotencyKey: 'wallet:test:1002',
      reasonCode: 'OPERATIONAL_CORRECTION',
    });
    expect(result.direction).toBe('DEBIT');
    expect(repo.reverse).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: posted.id, now }),
    );
    vi.mocked(repo.findTransaction).mockResolvedValue({ ...posted, reversedById: 'reversal-1' });
    await expect(
      service.reverse({
        transactionId: posted.id,
        actorUserId: 'admin-1',
        idempotencyKey: 'wallet:test:1003',
        reasonCode: 'OPERATIONAL_CORRECTION',
      }),
    ).rejects.toBeInstanceOf(WalletError);
  });
  it('serializes private wallet projection and never exposes a system account', async () => {
    const repo = repository();
    expect(await new WalletQueryService(repo, clock).getMine('user-1')).toEqual({
      id: 'wallet-1',
      status: 'ACTIVE',
      asset: { code: 'ARENA_POINT', name: 'Arena Point', monetary: false, withdrawable: false },
      balance: '10',
      updatedAt: now,
    });
  });
  it('reports reconciliation without applying any correction', async () => {
    const repo = repository();
    const result = await new WalletReconciliationService(repo, clock).reconcile(
      'user-1',
      'admin-1',
    );
    expect(result).toEqual({
      consistent: true,
      storedBalance: 10n,
      derivedBalance: 10n,
      difference: 0n,
    });
    expect(repo.reconcile).toHaveBeenCalledWith('user-1', 'admin-1', now);
    expect(repo.post).not.toHaveBeenCalled();
  });
});
