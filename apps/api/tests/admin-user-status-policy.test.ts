import { ConflictException } from '@nestjs/common';
import {
  assertAdminUserStatusTransition,
  isSuspensionExpired,
  resolveEffectiveUserStatus,
} from '../src/admin-operations/admin-user-status-policy';
import { describe, expect, it } from 'vitest';

function exceptionCode(callback: () => void): string | undefined {
  try {
    callback();
  } catch (error) {
    if (error instanceof ConflictException) {
      const response = error.getResponse();

      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    throw error;
  }

  return undefined;
}

describe('admin user status policy', () => {
  it.each([
    ['ACTIVE', 'SUSPENDED'],
    ['ACTIVE', 'BANNED'],
    ['SUSPENDED', 'ACTIVE'],
    ['SUSPENDED', 'BANNED'],
    ['BANNED', 'ACTIVE'],
  ] as const)('allows %s to transition to %s', (currentStatus, nextStatus) => {
    expect(() => assertAdminUserStatusTransition(currentStatus, nextStatus, null)).not.toThrow();
  });

  it.each([
    ['ACTIVE', 'ACTIVE'],
    ['SUSPENDED', 'SUSPENDED'],
    ['BANNED', 'BANNED'],
  ] as const)('rejects unchanged %s status', (currentStatus, nextStatus) => {
    expect(
      exceptionCode(() => assertAdminUserStatusTransition(currentStatus, nextStatus, null)),
    ).toBe('ADMIN_USER_STATUS_UNCHANGED');
  });

  it.each([
    ['PENDING_VERIFICATION', 'ACTIVE'],
    ['PENDING_VERIFICATION', 'SUSPENDED'],
    ['PENDING_VERIFICATION', 'BANNED'],
    ['ACTIVE', 'ACTIVE'],
    ['BANNED', 'SUSPENDED'],
  ] as const)('rejects invalid transition from %s to %s', (currentStatus, nextStatus) => {
    const code = exceptionCode(() =>
      assertAdminUserStatusTransition(currentStatus, nextStatus, null),
    );

    expect(['ADMIN_USER_STATUS_TRANSITION_INVALID', 'ADMIN_USER_STATUS_UNCHANGED']).toContain(code);
  });

  it('requires deleted users to use the restore operation', () => {
    expect(
      exceptionCode(() => assertAdminUserStatusTransition('DELETED', 'ACTIVE', new Date())),
    ).toBe('ADMIN_DELETED_USER_STATUS_CHANGE_FORBIDDEN');
  });

  it('rejects ordinary changes for disabled users', () => {
    expect(exceptionCode(() => assertAdminUserStatusTransition('DISABLED', 'ACTIVE', null))).toBe(
      'ADMIN_DISABLED_USER_STATUS_CHANGE_FORBIDDEN',
    );
  });

  it('detects an expired temporary suspension', () => {
    const now = new Date('2026-08-05T00:00:00.000Z');

    expect(
      isSuspensionExpired({
        status: 'SUSPENDED',
        suspendedUntil: new Date('2026-08-04T23:59:59.000Z'),
        now,
      }),
    ).toBe(true);

    expect(
      resolveEffectiveUserStatus({
        status: 'SUSPENDED',
        suspendedUntil: new Date('2026-08-04T23:59:59.000Z'),
        now,
      }),
    ).toBe('ACTIVE');
  });

  it('does not expire permanent or future restrictions', () => {
    const now = new Date('2026-08-05T00:00:00.000Z');

    expect(
      isSuspensionExpired({
        status: 'SUSPENDED',
        suspendedUntil: new Date('2026-08-06T00:00:00.000Z'),
        now,
      }),
    ).toBe(false);

    expect(
      resolveEffectiveUserStatus({
        status: 'BANNED',
        suspendedUntil: null,
        now,
      }),
    ).toBe('BANNED');
  });
});
