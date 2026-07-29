import type { MatchRepository } from './match-repository';

export interface MatchTransactionManager {
  transaction<T>(operation: (repository: MatchRepository) => Promise<T>): Promise<T>;
}
