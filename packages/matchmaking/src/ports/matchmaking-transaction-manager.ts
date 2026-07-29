import type { MatchmakingRepository } from './matchmaking-repository';

export interface MatchmakingTransactionManager {
  transaction<T>(operation: (repository: MatchmakingRepository) => Promise<T>): Promise<T>;
}
