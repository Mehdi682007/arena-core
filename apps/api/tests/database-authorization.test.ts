import { describe, expect, it, vi } from 'vitest';
import { DatabaseAuthorizationService } from '../src/authorization/database-authorization.service';
import type { DatabaseService } from '../src/database/database.service';

function createService(result: { userId: string } | null) {
  const findFirst = vi.fn().mockResolvedValue(result);
  const database = {
    getClient: () => ({ userRole: { findFirst } }),
  } as unknown as DatabaseService;

  return {
    service: new DatabaseAuthorizationService(database),
    findFirst,
  };
}

describe('DatabaseAuthorizationService', () => {
  it('denies access when the database is unavailable', async () => {
    const database = {
      getClient: () => undefined,
    } as unknown as DatabaseService;

    const service = new DatabaseAuthorizationService(database);

    await expect(service.hasPermission('user-1', 'roles.read')).resolves.toBe(false);
  });

  it('denies access when no active role grants the permission', async () => {
    const { service } = createService(null);

    await expect(service.hasPermission('user-1', 'roles.read')).resolves.toBe(false);
  });

  it('accepts a permission granted by an active role assignment', async () => {
    const { service } = createService({ userId: 'user-1' });

    await expect(service.hasPermission('user-1', 'roles.read')).resolves.toBe(true);
  });

  it('queries only permanent or non-expired role assignments', async () => {
    const { service, findFirst } = createService({ userId: 'user-1' });

    await service.hasPermission('user-1', 'roles.read');

    expect(findFirst).toHaveBeenCalledOnce();

    const query = findFirst.mock.calls[0]?.[0] as {
      where: {
        userId: string;
        OR: readonly [{ expiresAt: null }, { expiresAt: { gt: Date } }];
        role: {
          permissions: {
            some: {
              permission: {
                key: string;
              };
            };
          };
        };
      };
    };

    expect(query.where.userId).toBe('user-1');
    expect(query.where.OR[0]).toEqual({ expiresAt: null });
    expect(query.where.OR[1].expiresAt.gt).toBeInstanceOf(Date);
    expect(query.where.role.permissions.some.permission.key).toBe('roles.read');
  });
});
