import { Prisma, type ArenaPrismaClient } from '@arena-core/database';
import { CatalogError } from '../domain/catalog-errors';
import type {
  AttachPlatformInput,
  CatalogRecord,
  CreateGameInput,
  CreateGameModeInput,
  CreateCrossplayGroupInput,
  CreatePlatformInput,
  CreateRulesetInput,
  PublicGame,
  PublicGameSummary,
  PublicRuleset,
  RulesetConfig,
  RulesetRecord,
  SetCrossplayPlatformsInput,
  UpdateGameInput,
} from '../domain/catalog-types';
import type {
  GameCatalogRepository,
  GameCatalogTransactionManager,
} from '../ports/game-catalog-repository';

type CatalogClient = ArenaPrismaClient | Prisma.TransactionClient;
const publicPlatformSelect = {
  isDefault: true,
  platform: { select: { id: true, key: true, slug: true, name: true, family: true } },
} as const;

export class PrismaGameCatalogRepository implements GameCatalogRepository {
  public constructor(private readonly client: CatalogClient) {}

  public async listPublicGames(): Promise<readonly PublicGameSummary[]> {
    const games = await this.client.game.findMany({
      where: { status: 'ACTIVE', isVisible: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        slug: true,
        name: true,
        shortName: true,
        description: true,
        platforms: {
          where: { status: 'ACTIVE', platform: { status: 'ACTIVE' } },
          orderBy: [{ sortOrder: 'asc' }, { platform: { name: 'asc' } }],
          select: publicPlatformSelect,
        },
      },
    });
    return games.map((game) => ({
      id: game.id,
      key: game.key,
      slug: game.slug,
      name: game.name,
      shortName: game.shortName,
      description: game.description,
      platforms: game.platforms.map((entry) => ({ ...entry.platform, isDefault: entry.isDefault })),
    }));
  }

  public async findPublicGameBySlug(slug: string): Promise<PublicGame | null> {
    const game = await this.client.game.findFirst({
      where: { slug, status: 'ACTIVE', isVisible: true },
      select: {
        id: true,
        key: true,
        slug: true,
        name: true,
        shortName: true,
        description: true,
        platforms: {
          where: { status: 'ACTIVE', platform: { status: 'ACTIVE' } },
          orderBy: [{ sortOrder: 'asc' }],
          select: publicPlatformSelect,
        },
        modes: {
          where: { status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            key: true,
            slug: true,
            name: true,
            description: true,
            teamSizeMin: true,
            teamSizeMax: true,
            participantCountMin: true,
            participantCountMax: true,
          },
        },
      },
    });
    if (game === null) return null;
    return {
      id: game.id,
      key: game.key,
      slug: game.slug,
      name: game.name,
      shortName: game.shortName,
      description: game.description,
      platforms: game.platforms.map((entry) => ({ ...entry.platform, isDefault: entry.isDefault })),
      modes: game.modes,
    };
  }

  public async findDefaultPublicRuleset(
    slug: string,
    modeKey?: string,
  ): Promise<PublicRuleset | null> {
    const ruleset = await this.client.gameRuleset.findFirst({
      where: {
        isDefault: true,
        status: 'ACTIVE',
        game: { slug, status: 'ACTIVE', isVisible: true },
        gameMode: { status: 'ACTIVE', ...(modeKey ? { key: modeKey } : {}) },
      },
      orderBy: [{ gameMode: { sortOrder: 'asc' } }],
      select: {
        id: true,
        key: true,
        version: true,
        name: true,
        configuration: true,
        gameModeId: true,
        publishedAt: true,
      },
    });
    if (ruleset === null) return null;
    if (ruleset.publishedAt === null) throw new CatalogError('GAME_CATALOG_UNAVAILABLE');
    return {
      id: ruleset.id,
      key: ruleset.key,
      version: ruleset.version,
      name: ruleset.name,
      gameModeId: ruleset.gameModeId,
      configuration: ruleset.configuration as unknown as RulesetConfig,
      publishedAt: ruleset.publishedAt,
    };
  }

  public createGame(input: CreateGameInput): Promise<CatalogRecord> {
    return catalogWrite(() =>
      this.client.game.create({
        data: {
          key: input.key,
          slug: input.slug,
          name: input.name.trim(),
          shortName: input.shortName?.trim() ?? null,
          description: input.description ?? null,
          isVisible: input.isVisible ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true, status: true },
      }),
    );
  }
  public findGameById(id: string): Promise<CatalogRecord | null> {
    return this.client.game.findUnique({ where: { id }, select: { id: true, status: true } });
  }
  public updateGame(input: UpdateGameInput): Promise<CatalogRecord> {
    const archive =
      input.status === undefined
        ? {}
        : { status: input.status, archivedAt: input.status === 'ARCHIVED' ? new Date() : null };
    return catalogWrite(() =>
      this.client.game.update({
        where: { id: input.id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.shortName === undefined ? {} : { shortName: input.shortName.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isVisible === undefined ? {} : { isVisible: input.isVisible }),
          ...archive,
        },
        select: { id: true, status: true },
      }),
    );
  }
  public createPlatform(input: CreatePlatformInput): Promise<CatalogRecord> {
    return catalogWrite(() =>
      this.client.platform.create({
        data: {
          key: input.key,
          slug: input.slug,
          name: input.name.trim(),
          family: input.family,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true, status: true },
      }),
    );
  }
  public async attachPlatform(input: AttachPlatformInput): Promise<CatalogRecord> {
    if (input.isDefault === true)
      await this.client.gamePlatform.updateMany({
        where: { gameId: input.gameId, isDefault: true },
        data: { isDefault: false },
      });
    return this.client.gamePlatform.create({
      data: {
        gameId: input.gameId,
        platformId: input.platformId,
        isDefault: input.isDefault ?? false,
        externalLabel: input.externalLabel ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      select: { id: true, status: true },
    });
  }
  public createMode(input: CreateGameModeInput): Promise<CatalogRecord> {
    return catalogWrite(() =>
      this.client.gameMode.create({
        data: {
          gameId: input.gameId,
          key: input.key,
          slug: input.slug,
          name: input.name.trim(),
          description: input.description ?? null,
          teamSizeMin: input.teamSizeMin,
          teamSizeMax: input.teamSizeMax,
          participantCountMin: input.participantCountMin,
          participantCountMax: input.participantCountMax,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true, status: true },
      }),
    );
  }
  public createCrossplayGroup(input: CreateCrossplayGroupInput): Promise<CatalogRecord> {
    return this.client.crossplayGroup.create({
      data: {
        gameId: input.gameId,
        key: input.key,
        name: input.name.trim(),
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      select: { id: true, status: true },
    });
  }
  public async setCrossplayPlatforms(input: SetCrossplayPlatformsInput): Promise<CatalogRecord> {
    const group = await this.client.crossplayGroup.findFirst({
      where: { id: input.crossplayGroupId, gameId: input.gameId },
      select: { id: true, status: true },
    });
    if (group === null) throw new CatalogError('CATALOG_NOT_FOUND');
    const available = await this.client.gamePlatform.count({
      where: { gameId: input.gameId, id: { in: [...input.gamePlatformIds] } },
    });
    if (available !== input.gamePlatformIds.length) throw new CatalogError('INVALID_CATALOG_VALUE');
    await this.client.crossplayGroupPlatform.deleteMany({
      where: { crossplayGroupId: input.crossplayGroupId },
    });
    if (input.gamePlatformIds.length > 0)
      await this.client.crossplayGroupPlatform.createMany({
        data: input.gamePlatformIds.map((gamePlatformId) => ({
          gameId: input.gameId,
          crossplayGroupId: input.crossplayGroupId,
          gamePlatformId,
        })),
      });
    return group;
  }
  public async createRuleset(input: CreateRulesetInput): Promise<RulesetRecord> {
    const record = await catalogWrite(() =>
      this.client.gameRuleset.create({
        data: {
          gameId: input.gameId,
          gameModeId: input.gameModeId,
          key: input.key,
          version: input.version,
          name: input.name.trim(),
          description: input.description ?? null,
          configuration: input.configuration as unknown as Prisma.InputJsonValue,
        },
      }),
    );
    return mapRuleset(record);
  }
  public async findLatestRulesetVersion(gameId: string, key: string): Promise<number | null> {
    const record = await this.client.gameRuleset.findFirst({
      where: { gameId, key },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return record?.version ?? null;
  }
  public async findRulesetById(id: string): Promise<RulesetRecord | null> {
    const record = await this.client.gameRuleset.findUnique({ where: { id } });
    return record === null ? null : mapRuleset(record);
  }
  public async updateRulesetDraft(
    id: string,
    name: string,
    config: RulesetConfig,
  ): Promise<RulesetRecord> {
    const result = await this.client.gameRuleset.updateMany({
      where: { id, status: 'DRAFT' },
      data: { name: name.trim(), configuration: config as unknown as Prisma.InputJsonValue },
    });
    if (result.count !== 1) throw new CatalogError('RULESET_IMMUTABLE');
    const record = await this.findRulesetById(id);
    if (record === null) throw new CatalogError('CATALOG_NOT_FOUND');
    return record;
  }
  public async publishRuleset(id: string): Promise<RulesetRecord> {
    const draft = await this.client.gameRuleset.findUniqueOrThrow({ where: { id } });
    await this.client.gameRuleset.updateMany({
      where: {
        gameId: draft.gameId,
        key: draft.key,
        status: 'ACTIVE',
        id: { not: id },
      },
      data: { status: 'SUPERSEDED', isDefault: false },
    });
    return mapRuleset(
      await this.client.gameRuleset.update({
        where: { id },
        data: { status: 'ACTIVE', publishedAt: new Date() },
      }),
    );
  }
  public async setDefaultRuleset(id: string): Promise<RulesetRecord> {
    const existing = await this.client.gameRuleset.findUniqueOrThrow({ where: { id } });
    await this.client.gameRuleset.updateMany({
      where: { gameId: existing.gameId, gameModeId: existing.gameModeId, isDefault: true },
      data: { isDefault: false },
    });
    return mapRuleset(
      await this.client.gameRuleset.update({ where: { id }, data: { isDefault: true } }),
    );
  }
  public async transitionRuleset(
    id: string,
    status: 'SUPERSEDED' | 'ARCHIVED',
  ): Promise<RulesetRecord> {
    return mapRuleset(
      await this.client.gameRuleset.update({
        where: { id },
        data: {
          status,
          isDefault: false,
          archivedAt: status === 'ARCHIVED' ? new Date() : null,
        },
      }),
    );
  }
}

export class PrismaGameCatalogTransactionManager implements GameCatalogTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public transaction<T>(operation: (repository: GameCatalogRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((transaction) =>
      operation(new PrismaGameCatalogRepository(transaction)),
    );
  }
}

function mapRuleset(record: {
  id: string;
  gameId: string;
  gameModeId: string;
  key: string;
  version: number;
  name: string;
  status: string;
  isDefault: boolean;
  configuration: Prisma.JsonValue;
}): RulesetRecord {
  return {
    id: record.id,
    gameId: record.gameId,
    gameModeId: record.gameModeId,
    key: record.key,
    version: record.version,
    name: record.name,
    status: record.status,
    isDefault: record.isDefault,
    configuration: record.configuration as unknown as RulesetConfig,
  };
}

async function catalogWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined;
    if (code === 'P2002' || code === 'P2003') throw new CatalogError('CATALOG_CONFLICT');
    if (code === 'P2025') throw new CatalogError('CATALOG_NOT_FOUND');
    throw new CatalogError('GAME_CATALOG_UNAVAILABLE');
  }
}
