import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { CatalogError, PrismaGameCatalogRepository } from '../src';

describe('Prisma game catalog adapter', () => {
  it('uses active-visible filters, stable ordering, and explicit public selects', async () => {
    const findMany = vi.fn(async () => []);
    const client = { game: { findMany } } as unknown as ArenaPrismaClient;
    await new PrismaGameCatalogRepository(client).listPublicGames();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', isVisible: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: expect.objectContaining({
          id: true,
          key: true,
          slug: true,
          shortName: true,
          platforms: expect.any(Object),
        }),
      }),
    );
    expect(JSON.stringify(findMany.mock.calls[0])).not.toMatch(/user|session|email|password/i);
  });

  it('maps a public game without leaking internal state', async () => {
    const findFirst = vi.fn(async () => ({
      id: 'g',
      key: 'game',
      slug: 'game-one',
      name: 'Game',
      shortName: null,
      description: null,
      platforms: [],
      modes: [],
    }));
    const client = { game: { findFirst } } as unknown as ArenaPrismaClient;
    await expect(
      new PrismaGameCatalogRepository(client).findPublicGameBySlug('game-one'),
    ).resolves.toEqual({
      id: 'g',
      key: 'game',
      slug: 'game-one',
      name: 'Game',
      shortName: null,
      description: null,
      platforms: [],
      modes: [],
    });
  });

  it('maps unique errors and redacts Prisma details', async () => {
    const create = vi.fn(async () => {
      throw { code: 'P2002', meta: { target: ['secret'] } };
    });
    const client = { game: { create } } as unknown as ArenaPrismaClient;
    const promise = new PrismaGameCatalogRepository(client).createGame({
      key: 'game',
      slug: 'game-one',
      name: 'Game',
    });
    await expect(promise).rejects.toEqual(new CatalogError('CATALOG_CONFLICT'));
    await expect(promise).rejects.not.toHaveProperty('meta');
  });
});
