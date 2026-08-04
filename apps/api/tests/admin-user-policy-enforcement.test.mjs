import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/admin-operations/admin-user-access.service.ts'),
  'utf8',
);

describe('admin user policy enforcement', () => {
  it('prevents administrators from changing their own account status', () => {
    expect(source).toContain("code: 'ADMIN_SELF_STATUS_CHANGE_FORBIDDEN'");

    expect(source).toContain('actorUserId === userId');
  });

  it('loads active system-role assignments for restrictive transitions', () => {
    expect(source).toContain('roleAssignments: {');

    expect(source).toContain('isSystem: true');

    expect(source).toContain('expiresAt: {');

    expect(source).toContain('gt: now');
  });

  it('prevents restricting the final active holder of a system role', () => {
    expect(source).toContain("code: 'ADMIN_LAST_SYSTEM_ROLE_HOLDER'");

    expect(source).toContain('transaction.userRole.count');

    expect(source).toContain('activeHolderCount <= 1');

    expect(source).toContain("restricted && existing.status === 'ACTIVE'");

    expect(source).toContain('cannot be suspended or banned');
  });

  it('counts only active non-deleted holders with unexpired assignments', () => {
    expect(source).toContain("status: 'ACTIVE'");

    expect(source).toContain('deletedAt: null');

    expect(source).toContain('roleId: assignment.roleId');
  });
});
