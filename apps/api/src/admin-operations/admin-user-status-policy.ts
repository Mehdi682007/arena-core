import { ConflictException } from '@nestjs/common';

export type ManagedUserStatus =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DISABLED' | 'DELETED';

export type AdminManagedUserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

const allowedTransitions: Readonly<Record<ManagedUserStatus, readonly AdminManagedUserStatus[]>> =
  Object.freeze({
    PENDING_VERIFICATION: [],
    ACTIVE: ['SUSPENDED', 'BANNED'],
    SUSPENDED: ['ACTIVE', 'BANNED'],
    BANNED: ['ACTIVE'],
    DISABLED: [],
    DELETED: [],
  });

export function assertAdminUserStatusTransition(
  currentStatus: ManagedUserStatus,
  nextStatus: AdminManagedUserStatus,
  deletedAt: Date | null,
): void {
  if (deletedAt !== null || currentStatus === 'DELETED') {
    throw new ConflictException({
      code: 'ADMIN_DELETED_USER_STATUS_CHANGE_FORBIDDEN',
      message: 'Deleted users must be restored through the dedicated restore operation.',
    });
  }

  if (currentStatus === 'DISABLED') {
    throw new ConflictException({
      code: 'ADMIN_DISABLED_USER_STATUS_CHANGE_FORBIDDEN',
      message: 'Disabled users cannot be changed through the ordinary status operation.',
    });
  }

  if (currentStatus === nextStatus) {
    throw new ConflictException({
      code: 'ADMIN_USER_STATUS_UNCHANGED',
      message: 'The requested status is already active for this user.',
    });
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new ConflictException({
      code: 'ADMIN_USER_STATUS_TRANSITION_INVALID',
      message: `Transition from ${currentStatus} to ${nextStatus} is not allowed.`,
    });
  }
}

export function isSuspensionExpired(input: {
  status: ManagedUserStatus;
  suspendedUntil: Date | null;
  now: Date;
}): boolean {
  return (
    input.status === 'SUSPENDED' &&
    input.suspendedUntil !== null &&
    input.suspendedUntil <= input.now
  );
}

export function resolveEffectiveUserStatus(input: {
  status: ManagedUserStatus;
  suspendedUntil: Date | null;
  now: Date;
}): ManagedUserStatus {
  return isSuspensionExpired(input) ? 'ACTIVE' : input.status;
}
