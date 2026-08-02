import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ArenaPrismaClient } from '@arena-core/database';
import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSION_KEYS, bootstrapAdministrator, seedSystemRbac } from '../src';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/require-await, @typescript-eslint/restrict-template-expressions -- deliberately small in-memory Prisma test double */

function fakeClient(overrides: Record<string, unknown> = {}) {
  const permissions = new Map<string, { id: string; description: string }>();
  const rolePermissions = new Set<string>();
  const roles = new Map<
    string,
    { id: string; name: string; description: string; isSystem: boolean }
  >();
  const audit: unknown[] = [];
  const userRoles = new Set<string>();
  const target: any = {
    id: 'email-1',
    isPrimary: true,
    verifiedAt: new Date(),
    user: { id: 'user-1', status: 'ACTIVE', deletedAt: null },
    ...((overrides.target as object) ?? {}),
  };
  const client: any = {
    permission: {
      upsert: async ({ where, create, update }: any) => {
        const current = permissions.get(where.key);
        const value = current
          ? { ...current, ...update }
          : { id: `permission-${permissions.size + 1}`, description: create.description };
        permissions.set(where.key, value);
        return { id: value.id };
      },
    },
    role: {
      upsert: async ({ where, create, update }: any) => {
        const current = roles.get(where.key);
        const value = current ? { ...current, ...update } : { id: 'role-1', ...create };
        roles.set(where.key, value);
        return { id: value.id };
      },
      findUnique: async () => (overrides.missingRole ? null : { id: 'role-1' }),
    },
    rolePermission: {
      upsert: async ({ create }: any) => {
        rolePermissions.add(`${create.roleId}:${create.permissionId}`);
        return { roleId: create.roleId };
      },
    },
    userEmail: {
      findMany: async () => overrides.matches ?? [target],
      update: async ({ data }: any) => {
        target.verifiedAt = data.verifiedAt;
        return { id: target.id };
      },
    },
    user: {
      updateMany: async () => {
        target.user.status = 'ACTIVE';
        return { count: 1 };
      },
    },
    userRole: {
      findUnique: async () => (userRoles.has('user-1:role-1') ? { userId: 'user-1' } : null),
      update: async () => ({ userId: 'user-1' }),
      create: async () => {
        userRoles.add('user-1:role-1');
        return { userId: 'user-1' };
      },
    },
    adminAuditEvent: {
      create: async ({ data }: any) => {
        audit.push(data);
        return { id: `audit-${audit.length}` };
      },
    },
  };
  client.$transaction = async (operation: (value: unknown) => unknown) => operation(client);
  return {
    client: client as ArenaPrismaClient,
    permissions,
    roles,
    rolePermissions,
    userRoles,
    audit,
    target,
  };
}

describe('administrative RBAC', () => {
  it('has exactly 37 unique keys and covers every permission decorator', () => {
    expect(ADMIN_PERMISSION_KEYS).toHaveLength(37);
    expect(new Set(ADMIN_PERMISSION_KEYS).size).toBe(37);
    const root = path.resolve(process.cwd(), '../..');
    const controllers = [
      'admin-operations/admin-operations.controller.ts',
      'game-catalog/admin-catalog.controller.ts',
      'player-identity/admin-game-account.controller.ts',
      'matches/admin-matches.controller.ts',
      'matches/admin-match-results.controller.ts',
      'matches/admin-match-dispute.controller.ts',
      'matchmaking/admin-matchmaking.controller.ts',
      'wallet/admin-wallet.controller.ts',
      'match-finance/admin-match-finance.controller.ts',
      'match-finance/settlements/admin-match-settlement.controller.ts',
      'ratings/admin/admin-ratings.controller.ts',
      'notifications/admin/admin-notifications.controller.ts',
    ]
      .map((file) => readFileSync(path.join(root, 'apps/api/src', file), 'utf8'))
      .join('\n');
    const used = [...controllers.matchAll(/@Require[A-Za-z]+Permission\(\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((key) => !ADMIN_PERMISSION_KEYS.includes(key as never))).toEqual([]);
  });

  it('seeds twice without duplicates and preserves custom rows or assigning users', async () => {
    const state = fakeClient();
    state.permissions.set('custom.permission', { id: 'custom', description: 'Custom' });
    state.roles.set('custom', {
      id: 'custom-role',
      name: 'Custom',
      description: 'Custom',
      isSystem: false,
    });
    await seedSystemRbac(state.client);
    await seedSystemRbac(state.client);
    expect(state.permissions.size).toBe(38);
    expect(state.roles.get('custom')).toBeDefined();
    expect(state.rolePermissions.size).toBe(37);
    expect(state.userRoles.size).toBe(0);
  });

  it('requires verification and atomically activates, assigns, audits, and no-ops safely', async () => {
    const state = fakeClient({
      target: {
        verifiedAt: null,
        user: { id: 'user-1', status: 'PENDING_VERIFICATION', deletedAt: null },
      },
    });
    await expect(
      bootstrapAdministrator(state.client, { email: 'Admin@Example.test', verifyEmail: false }),
    ).rejects.toThrow('VERIFIED_EMAIL_REQUIRED');
    expect(
      await bootstrapAdministrator(state.client, {
        email: 'Admin@Example.test',
        verifyEmail: true,
      }),
    ).toEqual({
      assigned: true,
      alreadyAssigned: false,
      emailVerified: true,
      accountActivated: true,
    });
    expect(
      (
        await bootstrapAdministrator(state.client, {
          email: 'Admin@Example.test',
          verifyEmail: false,
        })
      ).alreadyAssigned,
    ).toBe(true);
    expect(JSON.stringify(state.audit)).not.toContain('admin@example.test');
  });

  it('rejects unknown, ambiguous, suspended, deleted, and missing-role targets', async () => {
    await expect(
      bootstrapAdministrator(fakeClient({ matches: [] }).client, {
        email: 'a@example.test',
        verifyEmail: false,
      }),
    ).rejects.toThrow('USER_NOT_FOUND');
    const row = fakeClient().target;
    await expect(
      bootstrapAdministrator(fakeClient({ matches: [row, row] }).client, {
        email: 'a@example.test',
        verifyEmail: false,
      }),
    ).rejects.toThrow('AMBIGUOUS');
    await expect(
      bootstrapAdministrator(
        fakeClient({ target: { user: { id: 'user-1', status: 'SUSPENDED', deletedAt: null } } })
          .client,
        { email: 'a@example.test', verifyEmail: false },
      ),
    ).rejects.toThrow('INELIGIBLE');
    await expect(
      bootstrapAdministrator(
        fakeClient({ target: { user: { id: 'user-1', status: 'DELETED', deletedAt: new Date() } } })
          .client,
        { email: 'a@example.test', verifyEmail: false },
      ),
    ).rejects.toThrow('DELETED');
    await expect(
      bootstrapAdministrator(fakeClient({ missingRole: true }).client, {
        email: 'a@example.test',
        verifyEmail: false,
      }),
    ).rejects.toThrow('SYSTEM_RBAC_MISSING');
  });
});
