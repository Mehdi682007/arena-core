import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { nextBalance } from '../domain/ledger-policies';
import { WalletError } from '../domain/wallet-errors';
import type {
  LedgerDirection,
  LedgerItemRecord,
  PostedTransaction,
  WalletRecord,
} from '../domain/wallet-types';
import type {
  PostLedgerInput,
  ReverseLedgerInput,
  WalletRepository,
} from '../ports/wallet-repository';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const walletSelect = {
  id: true,
  userId: true,
  status: true,
  updatedAt: true,
  accounts: {
    where: { assetCode: 'ARENA_POINT', type: 'USER_AVAILABLE' as const },
    select: { currentBalance: true },
    take: 1,
  },
} satisfies Prisma.WalletSelect;
const transactionSelect = {
  id: true,
  type: true,
  status: true,
  requestFingerprint: true,
  reversesTransactionId: true,
  reversedBy: { select: { id: true } },
  entries: {
    select: {
      direction: true,
      amount: true,
      balanceAfter: true,
      account: {
        select: {
          type: true,
          wallet: { select: { userId: true } },
        },
      },
    },
  },
} satisfies Prisma.LedgerTransactionSelect;
type WalletRow = Prisma.WalletGetPayload<{ select: typeof walletSelect }>;
type TransactionRow = Prisma.LedgerTransactionGetPayload<{ select: typeof transactionSelect }>;

const mapWallet = (row: WalletRow): WalletRecord => ({
  id: row.id,
  userId: row.userId,
  status: row.status,
  balance: row.accounts[0]?.currentBalance ?? 0n,
  updatedAt: row.updatedAt,
});
const mapTransaction = (row: TransactionRow): PostedTransaction => {
  const entry = row.entries.find((item) => item.account.type === 'USER_AVAILABLE');
  if (!entry?.account.wallet) throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
  return {
    id: row.id,
    userId: entry.account.wallet.userId,
    type: row.type,
    status: row.status,
    direction: entry.direction,
    amount: entry.amount,
    fingerprint: row.requestFingerprint,
    balanceAfter: entry.balanceAfter,
    reversedById: row.reversedBy?.id ?? null,
  };
};
function persistence(error: unknown): never {
  if (error instanceof WalletError) throw error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'P2002'
  )
    throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
  throw new WalletError('WALLET_PERSISTENCE_FAILURE');
}
async function inTransaction<T>(
  client: Client,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in client) return client.$transaction(operation);
  return operation(client);
}
async function ensureAccounts(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new WalletError('WALLET_NOT_FOUND');
  const wallet = await tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true, status: true },
  });
  const userAccount = await tx.ledgerAccount.upsert({
    where: {
      walletId_assetCode_type: {
        walletId: wallet.id,
        assetCode: 'ARENA_POINT',
        type: 'USER_AVAILABLE',
      },
    },
    create: {
      walletId: wallet.id,
      assetCode: 'ARENA_POINT',
      type: 'USER_AVAILABLE',
    },
    update: {},
    select: { id: true, currentBalance: true },
  });
  return { wallet, userAccount };
}
async function systemAccount(tx: Prisma.TransactionClient, kind: 'ISSUANCE' | 'ADJUSTMENT') {
  const systemKey = `arena_point_${kind.toLowerCase()}`;
  return tx.ledgerAccount.upsert({
    where: { systemKey_assetCode: { systemKey, assetCode: 'ARENA_POINT' } },
    create: {
      systemKey,
      assetCode: 'ARENA_POINT',
      type: kind === 'ISSUANCE' ? 'SYSTEM_ISSUANCE' : 'SYSTEM_ADJUSTMENT',
    },
    update: {},
    select: { id: true, currentBalance: true },
  });
}
async function lockAccounts(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<void> {
  const ordered = [...ids].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ledger_accounts" WHERE "id" IN (${Prisma.join(
      ordered,
    )}) ORDER BY "id" FOR UPDATE`,
  );
}

export class PrismaWalletRepository implements WalletRepository {
  public constructor(private readonly client: Client) {}
  public async ensureWallet(userId: string, now: Date): Promise<WalletRecord> {
    try {
      return await inTransaction(this.client, async (tx) => {
        const existing = await tx.wallet.findUnique({ where: { userId }, select: { id: true } });
        const { wallet } = await ensureAccounts(tx, userId);
        if (!existing)
          await tx.walletAuditEvent.create({
            data: {
              walletId: wallet.id,
              actorUserId: userId,
              action: 'WALLET_CREATED',
              reasonCode: 'LAZY_CREATION',
              createdAt: now,
            },
          });
        return mapWallet(
          await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id }, select: walletSelect }),
        );
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async getWallet(userId: string): Promise<WalletRecord | null> {
    const row = await this.client.wallet.findUnique({ where: { userId }, select: walletSelect });
    return row ? mapWallet(row) : null;
  }
  public async listEntries(
    userId: string,
    limit: number,
    cursor?: string,
    type?: 'ISSUANCE' | 'ADMIN_ADJUSTMENT' | 'REVERSAL',
    direction?: LedgerDirection,
  ): Promise<readonly LedgerItemRecord[]> {
    const rows = await this.client.ledgerEntry.findMany({
      where: {
        account: { type: 'USER_AVAILABLE', wallet: { userId } },
        ...(type ? { transaction: { type } } : {}),
        ...(direction ? { direction } : {}),
      },
      select: {
        id: true,
        transactionId: true,
        direction: true,
        amount: true,
        balanceAfter: true,
        createdAt: true,
        transaction: { select: { type: true, description: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      type: row.transaction.type,
      direction: row.direction,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      description: row.transaction.description,
      createdAt: row.createdAt,
    }));
  }
  public async findByIdempotencyKey(key: string): Promise<PostedTransaction | null> {
    const row = await this.client.ledgerTransaction.findUnique({
      where: { idempotencyKey: key },
      select: transactionSelect,
    });
    return row ? mapTransaction(row) : null;
  }
  public async findTransaction(transactionId: string): Promise<PostedTransaction | null> {
    const row = await this.client.ledgerTransaction.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });
    return row ? mapTransaction(row) : null;
  }
  public async post(input: PostLedgerInput): Promise<PostedTransaction> {
    try {
      return await inTransaction(this.client, async (tx) => {
        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: transactionSelect,
        });
        if (existing) {
          if (existing.requestFingerprint !== input.fingerprint)
            throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
          return mapTransaction(existing);
        }
        const { wallet, userAccount } = await ensureAccounts(tx, input.userId);
        if (wallet.status === 'SUSPENDED') throw new WalletError('WALLET_SUSPENDED');
        if (wallet.status === 'CLOSED') throw new WalletError('WALLET_CLOSED');
        const system = await systemAccount(
          tx,
          input.type === 'ISSUANCE' ? 'ISSUANCE' : 'ADJUSTMENT',
        );
        await lockAccounts(tx, [userAccount.id, system.id]);
        const fresh = await tx.ledgerAccount.findUniqueOrThrow({
          where: { id: userAccount.id },
          select: { currentBalance: true },
        });
        const userAfter = nextBalance(fresh.currentBalance, input.direction, input.amount);
        const systemDirection: LedgerDirection = input.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
        const systemAfter = nextBalance(
          system.currentBalance,
          systemDirection,
          input.amount,
          false,
        );
        const userUpdate = await tx.ledgerAccount.updateMany({
          where: {
            id: userAccount.id,
            ...(input.direction === 'DEBIT' ? { currentBalance: { gte: input.amount } } : {}),
          },
          data: {
            currentBalance: userAfter,
            version: { increment: 1 },
          },
        });
        if (!userUpdate.count) throw new WalletError('WALLET_INSUFFICIENT_BALANCE');
        await tx.ledgerAccount.update({
          where: { id: system.id },
          data: { currentBalance: systemAfter, version: { increment: 1 } },
        });
        const accounts = [
          { id: userAccount.id, direction: input.direction, balanceAfter: userAfter },
          { id: system.id, direction: systemDirection, balanceAfter: systemAfter },
        ].sort((left, right) => left.id.localeCompare(right.id));
        const transaction = await tx.ledgerTransaction.create({
          data: {
            type: input.type,
            assetCode: 'ARENA_POINT',
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.fingerprint,
            referenceType: input.type === 'ISSUANCE' ? 'SYSTEM_ISSUANCE' : 'ADMIN_ADJUSTMENT',
            description:
              input.type === 'ISSUANCE' ? 'Arena Point issuance' : 'Arena Point adjustment',
            ...(input.note === undefined ? {} : { internalNote: input.note }),
            createdByUserId: input.actorUserId,
            postedAt: input.now,
            entries: {
              create: accounts.map((account, index) => ({
                accountId: account.id,
                direction: account.direction,
                amount: input.amount,
                balanceAfter: account.balanceAfter,
                sequence: index + 1,
              })),
            },
          },
          select: transactionSelect,
        });
        await tx.walletAuditEvent.create({
          data: {
            walletId: wallet.id,
            actorUserId: input.actorUserId,
            action: input.type === 'ISSUANCE' ? 'POINTS_ISSUED' : 'BALANCE_ADJUSTED',
            reasonCode: input.reasonCode,
            transactionId: transaction.id,
            ...(input.note === undefined ? {} : { note: input.note }),
          },
        });
        return mapTransaction(transaction);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async reverse(input: ReverseLedgerInput): Promise<PostedTransaction> {
    try {
      return await inTransaction(this.client, async (tx) => {
        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: transactionSelect,
        });
        if (existing) {
          if (existing.requestFingerprint !== input.fingerprint)
            throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
          return mapTransaction(existing);
        }
        const original = await tx.ledgerTransaction.findUnique({
          where: { id: input.transactionId },
          select: transactionSelect,
        });
        if (!original) throw new WalletError('WALLET_TRANSACTION_NOT_FOUND');
        if (original.status !== 'POSTED' || original.type === 'REVERSAL' || original.reversedBy)
          throw new WalletError('WALLET_TRANSACTION_NOT_REVERSIBLE');
        const userEntry = original.entries.find((entry) => entry.account.type === 'USER_AVAILABLE');
        const systemEntry = original.entries.find(
          (entry) => entry.account.type !== 'USER_AVAILABLE',
        );
        if (!userEntry?.account.wallet || !systemEntry)
          throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: userEntry.account.wallet.userId },
          select: { id: true, status: true },
        });
        if (wallet.status !== 'ACTIVE')
          throw new WalletError(wallet.status === 'CLOSED' ? 'WALLET_CLOSED' : 'WALLET_SUSPENDED');
        const originalRows = await tx.ledgerEntry.findMany({
          where: { transactionId: original.id },
          select: {
            accountId: true,
            direction: true,
            amount: true,
            account: { select: { currentBalance: true, type: true } },
          },
        });
        await lockAccounts(
          tx,
          originalRows.map((entry) => entry.accountId),
        );
        const reversedEntries = originalRows
          .map((entry) => {
            const direction: LedgerDirection = entry.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
            return {
              accountId: entry.accountId,
              direction,
              amount: entry.amount,
              balanceAfter: nextBalance(
                entry.account.currentBalance,
                direction,
                entry.amount,
                entry.account.type === 'USER_AVAILABLE',
              ),
            };
          })
          .sort((left, right) => left.accountId.localeCompare(right.accountId));
        for (const entry of reversedEntries)
          await tx.ledgerAccount.update({
            where: { id: entry.accountId },
            data: { currentBalance: entry.balanceAfter, version: { increment: 1 } },
          });
        const reversal = await tx.ledgerTransaction.create({
          data: {
            type: 'REVERSAL',
            assetCode: 'ARENA_POINT',
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.fingerprint,
            referenceType: 'ADMIN_ADJUSTMENT',
            referenceId: original.id,
            description: 'Arena Point transaction reversal',
            ...(input.note === undefined ? {} : { internalNote: input.note }),
            createdByUserId: input.actorUserId,
            reversesTransactionId: original.id,
            postedAt: input.now,
            entries: {
              create: reversedEntries.map((entry, index) => ({ ...entry, sequence: index + 1 })),
            },
          },
          select: transactionSelect,
        });
        await tx.ledgerTransaction.update({
          where: { id: original.id, status: 'POSTED' },
          data: { status: 'REVERSED', reversedAt: input.now },
        });
        await tx.walletAuditEvent.create({
          data: {
            walletId: wallet.id,
            actorUserId: input.actorUserId,
            action: 'TRANSACTION_REVERSED',
            reasonCode: input.reasonCode,
            transactionId: reversal.id,
            ...(input.note === undefined ? {} : { note: input.note }),
          },
        });
        return mapTransaction(reversal);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async reconcile(userId: string, actorUserId: string, now: Date) {
    try {
      const wallet = await this.client.wallet.findUnique({
        where: { userId },
        select: {
          id: true,
          accounts: {
            where: { type: 'USER_AVAILABLE', assetCode: 'ARENA_POINT' },
            select: {
              currentBalance: true,
              entries: { select: { direction: true, amount: true } },
            },
            take: 1,
          },
        },
      });
      if (!wallet?.accounts[0]) throw new WalletError('WALLET_NOT_FOUND');
      const storedBalance = wallet.accounts[0].currentBalance;
      const derivedBalance = wallet.accounts[0].entries.reduce(
        (sum, entry) => sum + (entry.direction === 'CREDIT' ? entry.amount : -entry.amount),
        0n,
      );
      const difference = storedBalance - derivedBalance;
      await this.client.walletAuditEvent.create({
        data: {
          walletId: wallet.id,
          actorUserId,
          action: difference === 0n ? 'RECONCILIATION_CHECKED' : 'RECONCILIATION_MISMATCH',
          reasonCode: 'MANUAL_RECONCILIATION',
          createdAt: now,
        },
      });
      return { consistent: difference === 0n, storedBalance, derivedBalance, difference };
    } catch (error) {
      return persistence(error);
    }
  }
}
