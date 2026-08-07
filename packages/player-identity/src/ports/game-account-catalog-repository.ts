import type { ClaimableGamePlatform } from '../domain/player-identity-types';

export interface GameAccountCatalogRepository {
  listClaimableGamePlatforms(): Promise<readonly ClaimableGamePlatform[]>;
}
