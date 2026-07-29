import { AsyncLocalStorage } from 'node:async_hooks';
import type { ArenaPrismaClient } from '@arena-core/database';
import type { MatchFinanceTransactionManager } from '../ports/match-finance-transaction-manager';

type TransactionClient = Parameters<Parameters<ArenaPrismaClient['$transaction']>[0]>[0];

export class PrismaMatchFinanceTransactionManager implements MatchFinanceTransactionManager {
  private readonly storage = new AsyncLocalStorage<TransactionClient>();
  public constructor(private readonly client: ArenaPrismaClient) {}
  public current(): ArenaPrismaClient | TransactionClient {
    return this.storage.getStore() ?? this.client;
  }
  public transaction<T>(operation: () => Promise<T>): Promise<T> {
    const active = this.storage.getStore();
    if (active) return operation();
    return this.client.$transaction((transaction) => this.storage.run(transaction, operation));
  }
}
