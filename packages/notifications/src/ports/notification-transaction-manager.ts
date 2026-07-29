export interface NotificationTransactionManager<TRepository> {
  transaction<T>(operation: (repository: TRepository) => Promise<T>): Promise<T>;
}
