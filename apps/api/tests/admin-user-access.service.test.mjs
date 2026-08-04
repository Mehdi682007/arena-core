import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUserAccessService } from '../dist/admin-operations/admin-user-access.service.js';

const actorUserId = '00000000-0000-4000-8000-000000000901';

const targetUserId = '00000000-0000-4000-8000-000000000902';

const roleId = '00000000-0000-4000-8000-000000000903';

const createService = (transactionOverrides = {}) => {
  const transaction = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      updateMany: vi.fn(),
    },
    userEmail: {
      update: vi.fn(),
    },
    emailVerificationToken: {
      deleteMany: vi.fn(),
    },
    userRole: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    adminAuditEvent: {
      create: vi.fn(),
    },
    ...transactionOverrides,
  };

  const client = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(transaction)),
  };

  const database = {
    getClient: vi.fn(() => client),
  };

  return {
    service: new AdminUserAccessService(database),
    client,
    transaction,
    database,
  };
};

const exceptionCode = (error) => {
  if (error !== null && typeof error === 'object' && typeof error.getResponse === 'function') {
    const response = error.getResponse();

    if (response !== null && typeof response === 'object' && 'code' in response) {
      return response.code;
    }
  }

  return undefined;
};

describe('AdminUserAccessService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects changing the current administrator status', async () => {
    const { service, database } = createService();

    let thrown;

    try {
      await service.changeStatus(actorUserId, actorUserId, {
        status: 'BANNED',
        reasonCode: 'ADMIN_POLICY_VIOLATION',
      });
    } catch (error) {
      thrown = error;
    }

    expect(exceptionCode(thrown)).toBe('ADMIN_SELF_STATUS_CHANGE_FORBIDDEN');

    expect(database.getClient).not.toHaveBeenCalled();
  });

  it('rejects a suspension without a future expiry', async () => {
    const { service, database } = createService();

    let thrown;

    try {
      await service.changeStatus(actorUserId, targetUserId, {
        status: 'SUSPENDED',
        reasonCode: 'ADMIN_REVIEW',
        suspendedUntil: new Date(Date.now() - 60_000),
      });
    } catch (error) {
      thrown = error;
    }

    expect(exceptionCode(thrown)).toBe('ADMIN_SUSPENSION_EXPIRY_INVALID');

    expect(database.getClient).not.toHaveBeenCalled();
  });

  it('rejects an unchanged user status before mutation', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'ACTIVE',
      deletedAt: null,
      suspendedUntil: null,
      securityVersion: 4,
      roleAssignments: [],
    });

    let thrown;

    try {
      await service.changeStatus(actorUserId, targetUserId, {
        status: 'ACTIVE',
      });
    } catch (error) {
      thrown = error;
    }

    expect(exceptionCode(thrown)).toBe('ADMIN_USER_STATUS_UNCHANGED');

    expect(transaction.user.update).not.toHaveBeenCalled();

    expect(transaction.adminAuditEvent.create).not.toHaveBeenCalled();
  });

  it('requires deleted users to use the dedicated restore operation', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'DELETED',
      deletedAt: new Date(),
      suspendedUntil: null,
      securityVersion: 4,
      roleAssignments: [],
    });

    let thrown;

    try {
      await service.changeStatus(actorUserId, targetUserId, {
        status: 'ACTIVE',
      });
    } catch (error) {
      thrown = error;
    }

    expect(exceptionCode(thrown)).toBe('ADMIN_DELETED_USER_STATUS_CHANGE_FORBIDDEN');

    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('bans a user, revokes active sessions and records audit evidence', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'ACTIVE',
      deletedAt: null,
      suspendedUntil: null,
      securityVersion: 4,
      roleAssignments: [],
    });

    transaction.user.update.mockResolvedValue({
      id: targetUserId,
      status: 'BANNED',
      securityVersion: 5,
      statusChangedAt: new Date(),
      suspendedUntil: null,
      restrictionReasonCode: 'ADMIN_ABUSE',
      restrictionNote: 'Repeated abuse',
    });

    transaction.userSession.updateMany.mockResolvedValue({
      count: 3,
    });

    transaction.adminAuditEvent.create.mockResolvedValue({
      id: 'audit-1',
    });

    const result = await service.changeStatus(actorUserId, targetUserId, {
      status: 'BANNED',
      reasonCode: 'ADMIN_ABUSE',
      note: 'Repeated abuse',
    });

    expect(result.revokedSessions).toBe(3);

    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: targetUserId,
        },
        data: expect.objectContaining({
          status: 'BANNED',
          suspendedUntil: null,
          restrictionReasonCode: 'ADMIN_ABUSE',
          restrictionNote: 'Repeated abuse',
          securityVersion: {
            increment: 1,
          },
        }),
      }),
    );

    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
      },
      data: expect.objectContaining({
        status: 'REVOKED',
        revocationReason: 'ADMIN_USER_BANNED',
      }),
    });

    expect(transaction.adminAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId,
        action: 'USER_STATUS_CHANGED',
        targetType: 'USER',
        targetId: targetUserId,
        source: 'ADMIN_USER_ACCESS',
        metadata: expect.objectContaining({
          previousStatus: 'ACTIVE',
          nextStatus: 'BANNED',
          reasonCode: 'ADMIN_ABUSE',
          revokedSessions: 3,
          previousSecurityVersion: 4,
          nextSecurityVersion: 5,
        }),
      }),
      select: {
        id: true,
      },
    });
  });

  it('restores a user without revoking sessions and clears restriction metadata', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'SUSPENDED',
      deletedAt: null,
      suspendedUntil: new Date(Date.now() + 60_000),
      securityVersion: 8,
      roleAssignments: [],
    });

    transaction.user.update.mockResolvedValue({
      id: targetUserId,
      status: 'ACTIVE',
      securityVersion: 9,
      statusChangedAt: new Date(),
      suspendedUntil: null,
      restrictionReasonCode: null,
      restrictionNote: null,
    });

    transaction.adminAuditEvent.create.mockResolvedValue({
      id: 'audit-2',
    });

    const result = await service.changeStatus(actorUserId, targetUserId, {
      status: 'ACTIVE',
    });

    expect(result.revokedSessions).toBe(0);

    expect(transaction.userSession.updateMany).not.toHaveBeenCalled();

    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          suspendedUntil: null,
          restrictionReasonCode: null,
          restrictionNote: null,
          securityVersion: {
            increment: 1,
          },
        }),
      }),
    );
  });

  it('verifies the primary email, activates a pending user and records audit evidence', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'PENDING_VERIFICATION',
      securityVersion: 2,
      emails: [
        {
          id: '00000000-0000-4000-8000-000000000904',
          email: 'player@example.com',
          verifiedAt: null,
        },
      ],
    });

    transaction.userEmail.update.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000904',
    });

    transaction.emailVerificationToken.deleteMany.mockResolvedValue({
      count: 1,
    });

    transaction.user.update.mockResolvedValue({
      status: 'ACTIVE',
      securityVersion: 3,
      statusChangedAt: new Date(),
    });

    transaction.adminAuditEvent.create.mockResolvedValue({
      id: 'audit-email-1',
    });

    const result = await service.verifyEmail(actorUserId, targetUserId, {
      reasonCode: 'ADMIN_EMAIL_VERIFIED',
      note: 'Support confirmed mailbox ownership',
    });

    expect(result.changed).toBe(true);
    expect(result.status).toBe('ACTIVE');

    expect(transaction.userEmail.update).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000904',
      },
      data: {
        verifiedAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });

    expect(transaction.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userEmailId: '00000000-0000-4000-8000-000000000904',
      },
    });

    expect(transaction.adminAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId,
        action: 'USER_EMAIL_VERIFIED',
        targetType: 'USER',
        targetId: targetUserId,
        source: 'ADMIN_USER_ACCESS',
        metadata: expect.objectContaining({
          reasonCode: 'ADMIN_EMAIL_VERIFIED',
          previousStatus: 'PENDING_VERIFICATION',
          nextStatus: 'ACTIVE',
          previousSecurityVersion: 2,
          nextSecurityVersion: 3,
        }),
      }),
      select: {
        id: true,
      },
    });
  });

  it('returns an idempotent result when the primary email is already verified', async () => {
    const { service, transaction } = createService();

    const verifiedAt = new Date('2026-08-04T10:00:00.000Z');

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      status: 'ACTIVE',
      securityVersion: 7,
      emails: [
        {
          id: '00000000-0000-4000-8000-000000000904',
          email: 'player@example.com',
          verifiedAt,
        },
      ],
    });

    const result = await service.verifyEmail(actorUserId, targetUserId, {
      reasonCode: 'ADMIN_EMAIL_VERIFIED',
    });

    expect(result).toEqual({
      changed: false,
      email: 'player@example.com',
      verifiedAt,
      status: 'ACTIVE',
      securityVersion: 7,
    });

    expect(transaction.userEmail.update).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.adminAuditEvent.create).not.toHaveBeenCalled();
  });

  it('revokes all active sessions and increments the security version', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
      securityVersion: 12,
    });

    transaction.userSession.updateMany.mockResolvedValue({
      count: 4,
    });

    transaction.user.update.mockResolvedValue({
      securityVersion: 13,
    });

    transaction.adminAuditEvent.create.mockResolvedValue({
      id: 'audit-3',
    });

    const result = await service.revokeSessions(actorUserId, targetUserId, {
      reasonCode: 'ADMIN_SECURITY_RESET',
      note: 'Credential compromise suspected',
    });

    expect(result).toEqual({
      revokedSessions: 4,
      securityVersion: 13,
    });

    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
      },
      data: expect.objectContaining({
        status: 'REVOKED',
        revocationReason: 'ADMIN_SECURITY_RESET',
      }),
    });

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: {
        id: targetUserId,
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
  });

  it('prevents removing the final active holder of a system role', async () => {
    const { service, transaction } = createService();

    transaction.userRole.findUnique.mockResolvedValue({
      userId: targetUserId,
      expiresAt: null,
      role: {
        id: roleId,
        key: 'SUPER_ADMIN',
        name: 'Super Admin',
        isSystem: true,
      },
    });

    transaction.userRole.count.mockResolvedValue(1);

    let thrown;

    try {
      await service.removeRole(actorUserId, targetUserId, roleId);
    } catch (error) {
      thrown = error;
    }

    expect(exceptionCode(thrown)).toBe('ADMIN_LAST_SYSTEM_ROLE_HOLDER');

    expect(transaction.userRole.delete).not.toHaveBeenCalled();

    expect(transaction.adminAuditEvent.create).not.toHaveBeenCalled();
  });

  it('assigns a role with a normalized nullable expiry and records audit evidence', async () => {
    const { service, transaction } = createService();

    transaction.user.findUnique.mockResolvedValue({
      id: targetUserId,
    });

    transaction.role.findUnique.mockResolvedValue({
      id: roleId,
      key: 'SUPPORT_AGENT',
      name: 'Support Agent',
      isSystem: false,
    });

    transaction.userRole.upsert.mockResolvedValue({
      assignedAt: new Date('2026-08-04T00:00:00.000Z'),
      expiresAt: null,
    });

    transaction.adminAuditEvent.create.mockResolvedValue({
      id: 'audit-4',
    });

    const result = await service.assignRole(actorUserId, targetUserId, {
      roleId,
    });

    expect(result.role.id).toBe(roleId);

    expect(transaction.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: targetUserId,
          roleId,
          assignedByUserId: actorUserId,
          expiresAt: null,
        }),
        update: expect.objectContaining({
          assignedByUserId: actorUserId,
          expiresAt: null,
        }),
      }),
    );

    expect(transaction.adminAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId,
        action: 'ROLE_ASSIGNED',
        targetType: 'USER',
        targetId: targetUserId,
        metadata: expect.objectContaining({
          roleId,
          roleKey: 'SUPPORT_AGENT',
          isSystem: false,
          expiresAt: null,
        }),
      }),
      select: {
        id: true,
      },
    });
  });
});
