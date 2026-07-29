export interface RatingTransactionManager<TRepository> {
  transaction<T>(operation: (repository: TRepository) => Promise<T>): Promise<T>;
}
