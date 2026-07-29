import { describe, expect, it, vi } from 'vitest';
import {
  AdminGameCatalogService,
  CatalogError,
  GameRulesetService,
  PublicGameCatalogService,
  type GameCatalogRepository,
} from '../src';

function repository(): GameCatalogRepository {
  return {
    listPublicGames: vi.fn(async () => []),
    findPublicGameBySlug: vi.fn(async () => null),
    findDefaultPublicRuleset: vi.fn(async () => null),
    createGame: vi.fn(async () => ({ id: 'g', status: 'DRAFT' })),
    findGameById: vi.fn(async () => ({ id: 'g', status: 'DRAFT' })),
    updateGame: vi.fn(async () => ({ id: 'g', status: 'ACTIVE' })),
    createPlatform: vi.fn(async () => ({ id: 'p', status: 'ACTIVE' })),
    attachPlatform: vi.fn(async () => ({ id: 'gp', status: 'ACTIVE' })),
    createMode: vi.fn(async () => ({ id: 'm', status: 'DRAFT' })),
    createCrossplayGroup: vi.fn(async () => ({ id: 'c', status: 'ACTIVE' })),
    setCrossplayPlatforms: vi.fn(async () => ({ id: 'c', status: 'ACTIVE' })),
    createRuleset: vi.fn(async (input) => ({
      id: 'r',
      status: 'DRAFT',
      isDefault: false,
      ...input,
    })),
    findLatestRulesetVersion: vi.fn(async () => null),
    findRulesetById: vi.fn(async () => null),
    updateRulesetDraft: vi.fn(async () => {
      throw new Error('unused');
    }),
    publishRuleset: vi.fn(async () => {
      throw new Error('unused');
    }),
    transitionRuleset: vi.fn(async () => {
      throw new Error('unused');
    }),
    setDefaultRuleset: vi.fn(async () => {
      throw new Error('unused');
    }),
  };
}

describe('catalog application services', () => {
  it('returns not found without exposing persistence details', async () => {
    await expect(
      new PublicGameCatalogService(repository()).getGame('valid-game'),
    ).rejects.toMatchObject({
      code: 'CATALOG_NOT_FOUND',
    });
  });
  it('validates before an admin write', async () => {
    const repo = repository();
    const service = new AdminGameCatalogService(repo);
    expect(() =>
      service.createGame({
        key: 'Bad',
        slug: 'valid-game',
        name: 'Name',
        shortName: 'Name',
      }),
    ).toThrowError(CatalogError);
    expect(repo.createGame).not.toHaveBeenCalled();
  });
  it('applies allowed game status transitions', async () => {
    const repo = repository();
    await new AdminGameCatalogService(repo).updateGame({ id: 'g', status: 'ACTIVE' });
    expect(repo.updateGame).toHaveBeenCalledWith({ id: 'g', status: 'ACTIVE' });
  });
  it('keeps active rulesets immutable', async () => {
    const repo = repository();
    vi.mocked(repo.findRulesetById).mockResolvedValue({
      id: 'r',
      gameId: 'g',
      gameModeId: 'm',
      key: 'standard',
      version: 1,
      name: 'Standard',
      status: 'ACTIVE',
      isDefault: false,
      configuration: { schemaVersion: 1, settings: {} },
    });
    const service = new GameRulesetService(repo, { transaction: (operation) => operation(repo) });
    await expect(
      service.updateDraft('r', 'Changed', { schemaVersion: 1, settings: {} }),
    ).rejects.toMatchObject({ code: 'RULESET_IMMUTABLE' });
  });
  it('publishes inside the transaction boundary', async () => {
    const repo = repository();
    vi.mocked(repo.findRulesetById).mockResolvedValue({
      id: 'r',
      gameId: 'g',
      gameModeId: 'm',
      key: 'standard',
      version: 1,
      name: 'Standard',
      status: 'DRAFT',
      isDefault: false,
      configuration: { schemaVersion: 1, settings: {} },
    });
    vi.mocked(repo.publishRuleset).mockResolvedValue({
      ...(await repo.findRulesetById('r'))!,
      status: 'ACTIVE',
    });
    const transactionSpy = vi.fn();
    const transactions = {
      transaction: <T>(operation: (value: GameCatalogRepository) => Promise<T>): Promise<T> => {
        transactionSpy();
        return operation(repo);
      },
    };
    await new GameRulesetService(repo, transactions).publish('r');
    expect(transactionSpy).toHaveBeenCalledOnce();
    expect(repo.publishRuleset).toHaveBeenCalledWith('r');
  });
  it('rejects duplicate crossplay members before persistence', () => {
    const repo = repository();
    const service = new AdminGameCatalogService(repo);
    expect(() =>
      service.setCrossplayPlatforms({
        gameId: 'g',
        crossplayGroupId: 'c',
        gamePlatformIds: ['p', 'p'],
      }),
    ).toThrow();
    expect(repo.setCrossplayPlatforms).not.toHaveBeenCalled();
  });
  it('requires monotonically increasing ruleset versions', async () => {
    const repo = repository();
    vi.mocked(repo.findLatestRulesetVersion).mockResolvedValue(2);
    const service = new GameRulesetService(repo, { transaction: (operation) => operation(repo) });
    await expect(
      service.createDraft({
        gameId: 'g',
        gameModeId: 'm',
        key: 'standard',
        version: 2,
        name: 'Duplicate',
        configuration: { schemaVersion: 1, settings: {} },
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_CONFLICT' });
    expect(repo.createRuleset).not.toHaveBeenCalled();
  });
});
