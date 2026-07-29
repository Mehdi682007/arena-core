export interface MatchFinanceTransactionManager {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
export class DirectMatchFinanceTransactionManager implements MatchFinanceTransactionManager {
  public transaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}
