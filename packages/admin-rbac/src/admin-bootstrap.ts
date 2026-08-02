import type { ArenaPrismaClient } from '@arena-core/database';
import { normalizeEmail } from '@arena-core/identity';
import { SUPER_ADMIN_ROLE } from './system-rbac';
export interface AdminBootstrapResult {
  readonly assigned: boolean;
  readonly alreadyAssigned: boolean;
  readonly emailVerified: boolean;
  readonly accountActivated: boolean;
}
export async function bootstrapAdministrator(
  client: ArenaPrismaClient,
  input: Readonly<{ email: string; verifyEmail: boolean; now?: Date }>,
): Promise<AdminBootstrapResult> {
  const normalizedEmail = normalizeEmail(input.email).normalizedEmail;
  const now = input.now ?? new Date();
  return client.$transaction(async (transaction) => {
    const matches = await transaction.userEmail.findMany({
      where: { normalizedEmail },
      select: {
        id: true,
        isPrimary: true,
        verifiedAt: true,
        user: { select: { id: true, status: true, deletedAt: true } },
      },
      take: 2,
    });
    if (matches.length === 0) throw new Error('ADMIN_BOOTSTRAP_USER_NOT_FOUND');
    if (matches.length !== 1) throw new Error('ADMIN_BOOTSTRAP_AMBIGUOUS_EMAIL');
    const target = matches[0];
    if (!target?.isPrimary) throw new Error('ADMIN_BOOTSTRAP_PRIMARY_EMAIL_REQUIRED');
    if (target.user.deletedAt || target.user.status === 'DELETED')
      throw new Error('ADMIN_BOOTSTRAP_DELETED_USER');
    if (!['ACTIVE', 'PENDING_VERIFICATION'].includes(target.user.status))
      throw new Error('ADMIN_BOOTSTRAP_INELIGIBLE_USER');
    if (!target.verifiedAt && !input.verifyEmail)
      throw new Error('ADMIN_BOOTSTRAP_VERIFIED_EMAIL_REQUIRED');
    const emailVerified = !target.verifiedAt && input.verifyEmail;
    const accountActivated = emailVerified && target.user.status === 'PENDING_VERIFICATION';
    if (emailVerified) {
      await transaction.userEmail.update({
        where: { id: target.id },
        data: { verifiedAt: now },
        select: { id: true },
      });
      if (accountActivated) {
        const activated = await transaction.user.updateMany({
          where: { id: target.user.id, status: 'PENDING_VERIFICATION', deletedAt: null },
          data: { status: 'ACTIVE' },
        });
        if (activated.count !== 1) throw new Error('ADMIN_BOOTSTRAP_ACTIVATION_CONFLICT');
      }
    }
    const role = await transaction.role.findUnique({
      where: { key: SUPER_ADMIN_ROLE.key },
      select: { id: true },
    });
    if (!role) throw new Error('ADMIN_BOOTSTRAP_SYSTEM_RBAC_MISSING');
    const existing = await transaction.userRole.findUnique({
      where: { userId_roleId: { userId: target.user.id, roleId: role.id } },
      select: { userId: true },
    });
    if (existing)
      await transaction.userRole.update({
        where: { userId_roleId: { userId: target.user.id, roleId: role.id } },
        data: { expiresAt: null },
        select: { userId: true },
      });
    else
      await transaction.userRole.create({
        data: { userId: target.user.id, roleId: role.id, assignedByUserId: target.user.id },
        select: { userId: true },
      });
    await transaction.adminAuditEvent.create({
      data: {
        actorUserId: target.user.id,
        actorType: 'USER',
        action: existing ? 'ADMIN_BOOTSTRAP_CONFIRMED' : 'ADMIN_BOOTSTRAP_ASSIGNED',
        targetType: 'USER_ROLE',
        targetId: target.user.id,
        source: 'ADMIN_BOOTSTRAP_CLI',
        metadata: {
          roleKey: SUPER_ADMIN_ROLE.key,
          emailVerified,
          accountActivated,
          alreadyAssigned: Boolean(existing),
        },
      },
      select: { id: true },
    });
    return {
      assigned: !existing,
      alreadyAssigned: Boolean(existing),
      emailVerified,
      accountActivated,
    };
  });
}
