import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const serviceSource = readFileSync(
  resolve(process.cwd(), 'apps/api/src/admin-operations/admin-user-access.service.ts'),
  'utf8',
);

test('administrators cannot suspend or ban themselves', () => {
  assert.match(serviceSource, /restricted\s*&&\s*actorUserId\s*===\s*userId/);

  assert.match(serviceSource, /ADMIN_SELF_RESTRICTION_FORBIDDEN/);
});

test('the last active holder of a system role cannot be restricted', () => {
  assert.match(serviceSource, /role:\s*\{\s*isSystem:\s*true/);

  assert.match(serviceSource, /transaction\.userRole\.count/);

  assert.match(serviceSource, /activeHolders\s*<=\s*1/);

  assert.match(serviceSource, /ADMIN_LAST_SYSTEM_ROLE_HOLDER/);

  assert.match(serviceSource, /cannot be suspended or banned/);
});

test('system role protection applies only to restrictive transitions from active state', () => {
  assert.match(serviceSource, /restricted\s*&&\s*existing\.status\s*===\s*'ACTIVE'/);

  assert.match(serviceSource, /status:\s*'ACTIVE'/);
});
