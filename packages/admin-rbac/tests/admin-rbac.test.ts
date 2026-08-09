import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ArenaPrismaClient } from '@arena-core/database';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSION_KEYS,
  SUPER_ADMIN_ROLE,
  bootstrapAdministrator,
  seedSystemRbac,
} from '../src';
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
  const userRoleUpdates: unknown[] = [];
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
      findUnique: async () =>
        userRoles.has('user-1:role-1') ? { userId: 'user-1', expiresAt: new Date(0) } : null,
      update: async ({ data }: any) => {
        userRoleUpdates.push(data);
        return { userId: 'user-1' };
      },
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
    userRoleUpdates,
    target,
  };
}

describe('administrative RBAC', () => {
  it('has exactly 51 unique keys and covers every permission decorator', () => {
    expect(ADMIN_PERMISSION_KEYS).toHaveLength(51);
    expect(new Set(ADMIN_PERMISSION_KEYS).size).toBe(51);
    const root = path.resolve(process.cwd(), '../..');
    const apiRoot = path.join(root, 'apps/api/src');
    const controllers = readdirSync(apiRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.controller.ts'))
      .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
      .join('\n');
    const used = [...controllers.matchAll(/@Require[A-Za-z]+Permission\(\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((key) => !ADMIN_PERMISSION_KEYS.includes(key as never))).toEqual([]);
  });

  it('seeds twice without duplicates and preserves custom rows without assigning users', async () => {
    const state = fakeClient();

    state.permissions.set('custom.permission', {
      id: 'custom-permission',
      description: 'Custom',
    });

    state.roles.set('custom', {
      id: 'custom-role',
      name: 'Custom',
      description: 'Custom',
      isSystem: false,
    });

    state.rolePermissions.add('custom-role:custom-permission');

    await seedSystemRbac(state.client);

    const superAdmin = state.roles.get(SUPER_ADMIN_ROLE.key);

    expect(superAdmin).toBeDefined();

    if (!superAdmin) {
      throw new Error('super_admin was not seeded');
    }

    for (const key of ADMIN_PERMISSION_KEYS) {
      const permission = state.permissions.get(key);

      expect(permission).toBeDefined();

      if (!permission) {
        throw new Error(`permission was not seeded: ${key}`);
      }

      expect(state.rolePermissions.has(`${superAdmin.id}:${permission.id}`)).toBe(true);
    }

    const verifyEmailPermission = state.permissions.get('users.verify_email');

    expect(verifyEmailPermission).toBeDefined();

    if (!verifyEmailPermission) {
      throw new Error('users.verify_email was not seeded');
    }

    expect(state.rolePermissions.has(`${superAdmin.id}:${verifyEmailPermission.id}`)).toBe(true);

    expect(state.permissions.get('custom.permission')).toEqual({
      id: 'custom-permission',
      description: 'Custom',
    });

    expect(state.roles.get('custom')).toEqual({
      id: 'custom-role',
      name: 'Custom',
      description: 'Custom',
      isSystem: false,
    });

    expect(state.rolePermissions.has('custom-role:custom-permission')).toBe(true);
    expect([...state.userRoles]).toEqual([]);

    const permissionsAfterFirstSeed = new Map(state.permissions);
    const rolesAfterFirstSeed = new Map(state.roles);
    const rolePermissionsAfterFirstSeed = new Set(state.rolePermissions);

    await seedSystemRbac(state.client);

    expect(state.permissions).toEqual(permissionsAfterFirstSeed);
    expect(state.roles).toEqual(rolesAfterFirstSeed);
    expect(state.rolePermissions).toEqual(rolePermissionsAfterFirstSeed);
    expect([...state.userRoles]).toEqual([]);
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
    expect(JSON.stringify(state.audit)).not.toMatch(/password|secret|token/i);
    expect(state.userRoleUpdates).toEqual([{ expiresAt: null }]);
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
      bootstrapAdministrator(
        fakeClient({ target: { user: { id: 'user-1', status: 'DISABLED', deletedAt: null } } })
          .client,
        { email: 'a@example.test', verifyEmail: false },
      ),
    ).rejects.toThrow('INELIGIBLE');
    await expect(
      bootstrapAdministrator(fakeClient({ missingRole: true }).client, {
        email: 'a@example.test',
        verifyEmail: false,
      }),
    ).rejects.toThrow('SYSTEM_RBAC_MISSING');
  });
});
