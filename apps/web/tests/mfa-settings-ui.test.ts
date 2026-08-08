import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

function source(file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('MFA settings UI', () => {
  it('loads authenticated MFA status', () => {
    const page = source('src/app/(app)/settings/security/mfa/page.tsx');

    expect(page).toContain("'/auth/mfa'");

    expect(page).toContain('<MfaEnrollmentManager');
  });

  it('supports TOTP enrollment', () => {
    const manager = source('src/features/settings/mfa-enrollment-manager.tsx');

    expect(manager).toContain("'/auth/mfa/totp/enroll/start'");

    expect(manager).toContain("'/auth/mfa/totp/enroll/confirm'");

    expect(manager).toContain('autoComplete="one-time-code"');

    expect(manager).toContain('enrollment.otpauthUri');
  });

  it('shows recovery codes only from enrollment confirmation state', () => {
    const manager = source('src/features/settings/mfa-enrollment-manager.tsx');

    expect(manager).toContain('result.recoveryCodes');

    expect(manager).toContain("recoveryCodes.join('\\n')");

    expect(manager).not.toContain("'/auth/mfa/recovery-codes'");
  });

  it('links MFA from account security', () => {
    const security = source('src/app/(app)/settings/security/page.tsx');

    expect(security).toContain('href="/settings/security/mfa"');
  });
});
