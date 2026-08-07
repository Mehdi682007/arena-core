import type { ArenaPrismaClient } from '@arena-core/database';
import type { ClaimableGamePlatform } from '../domain/player-identity-types';
import type { GameAccountCatalogRepository } from '../ports/game-account-catalog-repository';

export class PrismaGameAccountCatalogRepository implements GameAccountCatalogRepository {
  public constructor(private readonly client: ArenaPrismaClient) {}

  public async listClaimableGamePlatforms(): Promise<readonly ClaimableGamePlatform[]> {
    const rows = await this.client.gamePlatform.findMany({
      where: {
        status: 'ACTIVE',
        game: { status: 'ACTIVE', isVisible: true },
        platform: { status: 'ACTIVE' },
      },
      orderBy: [
        { game: { sortOrder: 'asc' } },
        { game: { name: 'asc' } },
        { sortOrder: 'asc' },
        { platform: { name: 'asc' } },
      ],
      select: {
        id: true,
        game: { select: { id: true, key: true, slug: true, name: true } },
        platform: { select: { id: true, key: true, slug: true, name: true } },
      },
    });

    return rows.map((row) => ({
      game: row.game,
      platform: row.platform,
      gamePlatformId: row.id,
      gameActive: true,
      gamePlatformActive: true,
    }));
  }
}
