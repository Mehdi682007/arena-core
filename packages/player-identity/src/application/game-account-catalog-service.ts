import type { ClaimableGamePlatform } from '../domain/player-identity-types';
import type { GameAccountCatalogRepository } from '../ports/game-account-catalog-repository';

export class GameAccountCatalogService {
  public constructor(private readonly repository: GameAccountCatalogRepository) {}

  public listClaimableGamePlatforms(): Promise<readonly ClaimableGamePlatform[]> {
    return this.repository.listClaimableGamePlatforms();
  }
}
