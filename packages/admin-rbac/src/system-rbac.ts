import type { ArenaPrismaClient } from '@arena-core/database';
import { ADMIN_PERMISSION_CATALOG } from './catalog';
export const SUPER_ADMIN_ROLE = Object.freeze({
  key: 'super_admin',
  name: 'Super Administrator',
  description: 'System administrator with every Arena administrative permission.',
  isSystem: true,
});
export async function seedSystemRbac(client: ArenaPrismaClient) {
  return client.$transaction(async (transaction) => {
    const permissions = [];
    for (const [key, description] of ADMIN_PERMISSION_CATALOG) {
      permissions.push(
        await transaction.permission.upsert({
          where: { key },
          create: { key, description },
          update: { description },
          select: { id: true },
        }),
      );
    }
    const role = await transaction.role.upsert({
      where: { key: SUPER_ADMIN_ROLE.key },
      create: SUPER_ADMIN_ROLE,
      update: {
        name: SUPER_ADMIN_ROLE.name,
        description: SUPER_ADMIN_ROLE.description,
        isSystem: true,
      },
      select: { id: true },
    });
    for (const permission of permissions) {
      await transaction.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
        select: { roleId: true },
      });
    }
    return { permissionCount: permissions.length, roleKey: SUPER_ADMIN_ROLE.key };
  });
}
