import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { DatabaseService } from '../database/database.service';
import type {
  AdminEmailVerificationInput,
  AdminRoleAssignmentInput,
  AdminSessionRevocationInput,
  AdminUserDeletionInput,
  AdminUserListQuery,
  AdminUserStatusInput,
} from './admin-user-access.dto';

const userSummarySelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  lastAuthenticatedAt: true,
  statusChangedAt: true,
  suspendedUntil: true,
  restrictionReasonCode: true,
  restrictionNote: true,
  profile: {
    select: {
      displayName: true,
      locale: true,
      timezone: true,
      countryCode: true,
    },
  },
  emails: {
    where: {
      isPrimary: true,
    },
    select: {
      email: true,
      normalizedEmail: true,
      verifiedAt: true,
    },
    take: 1,
  },
} satisfies Prisma.UserSelect;

type UserSummaryRow = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

@Injectable()
export class AdminUserAccessService {
  public constructor(private readonly database: DatabaseService) {}

  public async listUsers(query: AdminUserListQuery) {
    const client = this.client();
    const where: Prisma.UserWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.term !== undefined) {
      const searchTerm = query.term;
      const normalizedTerm = searchTerm.toLowerCase();

      const alternatives: Prisma.UserWhereInput[] = [
        {
          emails: {
            some: {
              normalizedEmail: {
                contains: normalizedTerm,
              },
            },
          },
        },
        {
          profile: {
            is: {
              displayName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
      ];

      if (this.isUuid(searchTerm)) {
        alternatives.push({
          id: searchTerm,
        });
      }

      where.OR = alternatives;
    }

    const items = await client.user.findMany({
      where,
      select: userSummarySelect,
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: query.limit,
    });

    return {
      items: items.map((item) => this.mapUserSummary(item)),
    };
  }

  public async getUser(userId: string) {
    const client = this.client();

    const user = await client.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        ...userSummarySelect,
        securityVersion: true,
        sessions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
          select: {
            id: true,
            status: true,
            createdAt: true,
            lastSeenAt: true,
            expiresAt: true,
            revokedAt: true,
            revocationReason: true,
            userAgent: true,
          },
        },
        roleAssignments: {
          orderBy: {
            assignedAt: 'desc',
          },
          select: {
            assignedAt: true,
            expiresAt: true,
            assignedByUserId: true,
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                description: true,
                isSystem: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                        description: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
            gameAccounts: true,
            matchParticipants: true,
            notifications: true,
          },
        },
      },
    });

    if (user === null) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const now = new Date();

    const effectivePermissions = [
      ...new Set(
        user.roleAssignments
          .filter((assignment) => assignment.expiresAt === null || assignment.expiresAt > now)
          .flatMap((assignment) =>
            assignment.role.permissions.map((entry) => entry.permission.key),
          ),
      ),
    ].sort();

    return {
      ...this.mapUserSummary(user),
      securityVersion: user.securityVersion,
      sessions: user.sessions,
      roles: user.roleAssignments.map((assignment) => ({
        id: assignment.role.id,
        key: assignment.role.key,
        name: assignment.role.name,
        description: assignment.role.description,
        isSystem: assignment.role.isSystem,
        assignedAt: assignment.assignedAt,
        expiresAt: assignment.expiresAt,
        assignedByUserId: assignment.assignedByUserId,
        permissions: assignment.role.permissions
          .map((entry) => entry.permission)
          .sort((left, right) => left.key.localeCompare(right.key)),
      })),
      effectivePermissions,
      counts: user._count,
    };
  }

  public async changeStatus(actorUserId: string, userId: string, input: AdminUserStatusInput) {
    if (actorUserId === userId) {
      throw new ForbiddenException({
        code: 'ADMIN_SELF_STATUS_CHANGE_FORBIDDEN',
        message: 'Administrators cannot change their own account status.',
      });
    }

    const now = new Date();
    const restricted = input.status === 'SUSPENDED' || input.status === 'BANNED';

    let suspendedUntil: Date | null = null;
    let restrictionReasonCode: string | null = null;

    if (restricted) {
      if (input.reasonCode === undefined) {
        throw new ConflictException({
          code: 'ADMIN_RESTRICTION_REASON_REQUIRED',
          message: 'A restriction reason is required.',
        });
      }

      restrictionReasonCode = input.reasonCode;
    }

    if (input.status === 'SUSPENDED') {
      if (input.suspendedUntil === undefined) {
        throw new ConflictException({
          code: 'ADMIN_SUSPENSION_EXPIRY_REQUIRED',
          message: 'Suspension expiry is required.',
        });
      }

      if (input.suspendedUntil <= now) {
        throw new ConflictException({
          code: 'ADMIN_SUSPENSION_EXPIRY_INVALID',
          message: 'Suspension expiry must be in the future.',
        });
      }

      suspendedUntil = input.suspendedUntil;
    }

    const client = this.client();

    return client.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          status: true,
          securityVersion: true,
          roleAssignments: {
            where: {
              role: {
                is: {
                  isSystem: true,
                },
              },
              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gt: now,
                  },
                },
              ],
            },
            select: {
              roleId: true,
              role: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      });

      if (existing === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      if (restricted && existing.status === 'ACTIVE') {
        for (const assignment of existing.roleAssignments) {
          const activeHolderCount = await transaction.userRole.count({
            where: {
              roleId: assignment.roleId,
              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gt: now,
                  },
                },
              ],
              user: {
                is: {
                  deletedAt: null,
                  status: 'ACTIVE',
                },
              },
            },
          });

          if (activeHolderCount <= 1) {
            throw new ConflictException({
              code: 'ADMIN_LAST_SYSTEM_ROLE_HOLDER',
              message: `The final active holder of system role ${assignment.role.key} cannot be suspended or banned.`,
            });
          }
        }
      }

      const updated = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          status: input.status,
          statusChangedAt: now,
          suspendedUntil,
          restrictionReasonCode,
          restrictionNote: restricted ? (input.note ?? null) : null,
          securityVersion: {
            increment: 1,
          },
        },
        select: {
          id: true,
          status: true,
          securityVersion: true,
          statusChangedAt: true,
          suspendedUntil: true,
          restrictionReasonCode: true,
          restrictionNote: true,
        },
      });

      let revokedSessions = 0;

      if (restricted) {
        const result = await transaction.userSession.updateMany({
          where: {
            userId,
            status: 'ACTIVE',
          },
          data: {
            status: 'REVOKED',
            revokedAt: now,
            revocationReason:
              input.status === 'BANNED' ? 'ADMIN_USER_BANNED' : 'ADMIN_USER_SUSPENDED',
          },
        });

        revokedSessions = result.count;
      }

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'USER_STATUS_CHANGED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            previousStatus: existing.status,
            nextStatus: input.status,
            reasonCode: restrictionReasonCode,
            note: input.note ?? null,
            suspendedUntil: suspendedUntil?.toISOString() ?? null,
            revokedSessions,
            previousSecurityVersion: existing.securityVersion,
            nextSecurityVersion: updated.securityVersion,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        user: updated,
        revokedSessions,
      };
    });
  }

  public async verifyEmail(
    actorUserId: string,
    userId: string,
    input: AdminEmailVerificationInput,
  ) {
    const client = this.client();
    const now = new Date();

    return client.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          status: true,
          securityVersion: true,
          emails: {
            where: {
              isPrimary: true,
            },
            select: {
              id: true,
              email: true,
              verifiedAt: true,
            },
            take: 1,
          },
        },
      });

      if (user === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      const primaryEmail = user.emails[0];

      if (primaryEmail === undefined) {
        throw new ConflictException({
          code: 'ADMIN_PRIMARY_EMAIL_NOT_FOUND',
          message: 'The user does not have a primary email address.',
        });
      }

      if (primaryEmail.verifiedAt !== null) {
        return {
          changed: false,
          email: primaryEmail.email,
          verifiedAt: primaryEmail.verifiedAt,
          status: user.status,
          securityVersion: user.securityVersion,
        };
      }

      const nextStatus = user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status;

      await transaction.userEmail.update({
        where: {
          id: primaryEmail.id,
        },
        data: {
          verifiedAt: now,
        },
        select: {
          id: true,
        },
      });

      await transaction.emailVerificationToken.deleteMany({
        where: {
          userEmailId: primaryEmail.id,
        },
      });

      const updated = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          status: nextStatus,
          ...(nextStatus !== user.status
            ? {
                statusChangedAt: now,
              }
            : {}),
          securityVersion: {
            increment: 1,
          },
        },
        select: {
          status: true,
          securityVersion: true,
          statusChangedAt: true,
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'USER_EMAIL_VERIFIED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            emailId: primaryEmail.id,
            email: primaryEmail.email,
            reasonCode: input.reasonCode,
            note: input.note ?? null,
            previousStatus: user.status,
            nextStatus: updated.status,
            previousSecurityVersion: user.securityVersion,
            nextSecurityVersion: updated.securityVersion,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        changed: true,
        email: primaryEmail.email,
        verifiedAt: now,
        status: updated.status,
        securityVersion: updated.securityVersion,
      };
    });
  }

  public async deleteUser(actorUserId: string, userId: string, input: AdminUserDeletionInput) {
    if (actorUserId === userId) {
      throw new ForbiddenException({
        code: 'ADMIN_SELF_DELETION_FORBIDDEN',
        message: 'Administrators cannot delete their own account.',
      });
    }

    const client = this.client();
    const now = new Date();

    return client.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          securityVersion: true,
          roleAssignments: {
            where: {
              role: {
                isSystem: true,
              },
              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gt: now,
                  },
                },
              ],
            },
            select: {
              roleId: true,
              role: {
                select: {
                  key: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (user === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      if (user.deletedAt !== null || user.status === 'DELETED') {
        return {
          changed: false,
          deletedAt: user.deletedAt,
          status: user.status,
          securityVersion: user.securityVersion,
          revokedSessions: 0,
        };
      }

      for (const assignment of user.roleAssignments) {
        const activeHolders = await transaction.userRole.count({
          where: {
            roleId: assignment.roleId,
            OR: [
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  gt: now,
                },
              },
            ],
            user: {
              deletedAt: null,
              status: {
                not: 'DELETED',
              },
            },
          },
        });

        if (activeHolders <= 1) {
          throw new ConflictException({
            code: 'ADMIN_LAST_SYSTEM_ROLE_HOLDER',
            message: `The final active holder of system role ${assignment.role.key} cannot be deleted.`,
          });
        }
      }

      const revoked = await transaction.userSession.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          revocationReason: 'ADMIN_USER_DELETED',
        },
      });

      const updated = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          status: 'DELETED',
          deletedAt: now,
          statusChangedAt: now,
          suspendedUntil: null,
          restrictionReasonCode: input.reasonCode,
          restrictionNote: input.note ?? null,
          securityVersion: {
            increment: 1,
          },
        },
        select: {
          status: true,
          deletedAt: true,
          securityVersion: true,
          statusChangedAt: true,
          restrictionReasonCode: true,
          restrictionNote: true,
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'USER_SOFT_DELETED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            previousStatus: user.status,
            nextStatus: updated.status,
            previousDeletedAt: user.deletedAt,
            nextDeletedAt: updated.deletedAt?.toISOString() ?? null,
            reasonCode: input.reasonCode,
            note: input.note ?? null,
            revokedSessions: revoked.count,
            previousSecurityVersion: user.securityVersion,
            nextSecurityVersion: updated.securityVersion,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        changed: true,
        deletedAt: updated.deletedAt,
        status: updated.status,
        securityVersion: updated.securityVersion,
        revokedSessions: revoked.count,
      };
    });
  }

  public async restoreUser(actorUserId: string, userId: string, input: AdminUserDeletionInput) {
    const client = this.client();
    const now = new Date();

    return client.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          securityVersion: true,
          emails: {
            where: {
              isPrimary: true,
            },
            select: {
              verifiedAt: true,
            },
            take: 1,
          },
        },
      });

      if (user === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      if (user.deletedAt === null && user.status !== 'DELETED') {
        return {
          changed: false,
          deletedAt: null,
          status: user.status,
          securityVersion: user.securityVersion,
        };
      }

      const nextStatus =
        user.emails[0]?.verifiedAt === null || user.emails[0] === undefined
          ? 'PENDING_VERIFICATION'
          : 'ACTIVE';

      const updated = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          status: nextStatus,
          deletedAt: null,
          statusChangedAt: now,
          suspendedUntil: null,
          restrictionReasonCode: null,
          restrictionNote: null,
          securityVersion: {
            increment: 1,
          },
        },
        select: {
          status: true,
          deletedAt: true,
          securityVersion: true,
          statusChangedAt: true,
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'USER_RESTORED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            previousStatus: user.status,
            nextStatus: updated.status,
            previousDeletedAt: user.deletedAt?.toISOString() ?? null,
            nextDeletedAt: null,
            reasonCode: input.reasonCode,
            note: input.note ?? null,
            previousSecurityVersion: user.securityVersion,
            nextSecurityVersion: updated.securityVersion,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        changed: true,
        deletedAt: updated.deletedAt,
        status: updated.status,
        securityVersion: updated.securityVersion,
      };
    });
  }

  public async revokeSessions(
    actorUserId: string,
    userId: string,
    input: AdminSessionRevocationInput,
  ) {
    if (actorUserId === userId) {
      throw new ForbiddenException({
        code: 'ADMIN_SELF_SESSION_REVOCATION_FORBIDDEN',
        message: 'Administrators cannot revoke all of their own sessions.',
      });
    }

    const client = this.client();
    const now = new Date();

    return client.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          securityVersion: true,
        },
      });

      if (user === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      const result = await transaction.userSession.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          revocationReason: input.reasonCode,
        },
      });

      const updated = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          securityVersion: {
            increment: 1,
          },
        },
        select: {
          securityVersion: true,
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'USER_STATUS_CHANGED',
          targetType: 'USER_SESSION',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            operation: 'REVOKE_ALL_SESSIONS',
            reasonCode: input.reasonCode,
            note: input.note ?? null,
            revokedSessions: result.count,
            previousSecurityVersion: user.securityVersion,
            nextSecurityVersion: updated.securityVersion,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        revokedSessions: result.count,
        securityVersion: updated.securityVersion,
      };
    });
  }

  public async listRoles() {
    const client = this.client();

    const roles = await client.role.findMany({
      orderBy: [
        {
          isSystem: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: {
            permission: {
              select: {
                key: true,
                description: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return {
      items: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissions: role.permissions
          .map((entry) => entry.permission)
          .sort((left, right) => left.key.localeCompare(right.key)),
      })),
    };
  }

  public async assignRole(actorUserId: string, userId: string, input: AdminRoleAssignmentInput) {
    const client = this.client();
    const now = new Date();

    if (input.expiresAt !== undefined && input.expiresAt <= now) {
      throw new ConflictException({
        code: 'ADMIN_ROLE_EXPIRY_INVALID',
        message: 'Role expiry must be in the future.',
      });
    }

    const expiresAt = input.expiresAt ?? null;

    return client.$transaction(async (transaction) => {
      const [user, role] = await Promise.all([
        transaction.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
          },
        }),
        transaction.role.findUnique({
          where: {
            id: input.roleId,
          },
          select: {
            id: true,
            key: true,
            name: true,
            isSystem: true,
          },
        }),
      ]);

      if (user === null) {
        throw new NotFoundException({
          code: 'ADMIN_USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }

      if (role === null) {
        throw new NotFoundException({
          code: 'ADMIN_ROLE_NOT_FOUND',
          message: 'Role was not found.',
        });
      }

      const assignment = await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
        create: {
          userId,
          roleId: role.id,
          assignedByUserId: actorUserId,
          expiresAt,
        },
        update: {
          assignedByUserId: actorUserId,
          assignedAt: now,
          expiresAt,
        },
        select: {
          assignedAt: true,
          expiresAt: true,
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'ROLE_ASSIGNED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            roleId: role.id,
            roleKey: role.key,
            roleName: role.name,
            isSystem: role.isSystem,
            expiresAt: assignment.expiresAt?.toISOString() ?? null,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        role: {
          ...role,
          assignedAt: assignment.assignedAt,
          expiresAt: assignment.expiresAt,
        },
      };
    });
  }

  public async removeRole(actorUserId: string, userId: string, roleId: string) {
    const client = this.client();
    const now = new Date();

    return client.$transaction(async (transaction) => {
      const assignment = await transaction.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
        select: {
          userId: true,
          expiresAt: true,
          role: {
            select: {
              id: true,
              key: true,
              name: true,
              isSystem: true,
            },
          },
        },
      });

      if (assignment === null) {
        throw new NotFoundException({
          code: 'ADMIN_ROLE_ASSIGNMENT_NOT_FOUND',
          message: 'Role assignment was not found.',
        });
      }

      if (actorUserId === userId && assignment.role.isSystem) {
        throw new ForbiddenException({
          code: 'ADMIN_SELF_SYSTEM_ROLE_REMOVAL_FORBIDDEN',
          message: 'Administrators cannot remove their own system role.',
        });
      }

      if (assignment.role.isSystem) {
        const activeAssignments = await transaction.userRole.count({
          where: {
            roleId,
            OR: [
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  gt: now,
                },
              },
            ],
          },
        });

        if (activeAssignments <= 1) {
          throw new ConflictException({
            code: 'ADMIN_LAST_SYSTEM_ROLE_HOLDER',
            message: 'The final active holder of a system role cannot be removed.',
          });
        }
      }

      await transaction.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
      });

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId,
          actorType: 'SUPPORT',
          action: 'ROLE_REMOVED',
          targetType: 'USER',
          targetId: userId,
          source: 'ADMIN_USER_ACCESS',
          createdAt: now,
          metadata: {
            roleId: assignment.role.id,
            roleKey: assignment.role.key,
            roleName: assignment.role.name,
            isSystem: assignment.role.isSystem,
          },
        },
        select: {
          id: true,
        },
      });

      return {
        removed: true,
        roleId,
      };
    });
  }

  private client(): ArenaPrismaClient {
    const client = this.database.getClient();

    if (client === undefined) {
      throw new ServiceUnavailableException({
        code: 'ADMIN_USER_ACCESS_UNAVAILABLE',
        message: 'User administration is currently unavailable.',
      });
    }

    return client;
  }

  private isUuid(value: string | undefined): value is string {
    return (
      value !== undefined &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    );
  }

  private mapUserSummary(user: UserSummaryRow) {
    const primaryEmail = user.emails[0] ?? null;

    return {
      id: user.id,
      status: user.status,
      displayName: user.profile?.displayName ?? null,
      locale: user.profile?.locale ?? null,
      timezone: user.profile?.timezone ?? null,
      countryCode: user.profile?.countryCode ?? null,
      email: primaryEmail?.email ?? null,
      emailVerifiedAt: primaryEmail?.verifiedAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      lastAuthenticatedAt: user.lastAuthenticatedAt,
      statusChangedAt: user.statusChangedAt,
      suspendedUntil: user.suspendedUntil,
      restrictionReasonCode: user.restrictionReasonCode,
      restrictionNote: user.restrictionNote,
    };
  }
}
