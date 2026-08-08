import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

function source(file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

describe('phone identity web UI', () => {
  it('offers email and phone login methods', () => {
    const login = source('src/features/auth/login-methods.tsx');

    const phone = source('src/features/auth/phone-login-form.tsx');

    expect(login).toContain('<PhoneLoginForm');

    expect(login).toContain('<AuthForm');

    expect(phone).toContain("'/auth/phone/sign-in/request'");

    expect(phone).toContain("'/auth/phone/sign-in/confirm'");

    expect(phone).toContain('autoComplete="one-time-code"');
  });

  it('manages authenticated phone verification', () => {
    const manager = source('src/features/settings/phone-manager.tsx');

    const page = source('src/app/(app)/settings/phone/page.tsx');

    expect(manager).toContain("'/auth/phone/verification/request'");

    expect(manager).toContain("'/auth/phone/verification/confirm'");

    expect(page).toContain('serverApi<');

    expect(page).toContain("'/auth/phone'");
  });

  it('links phone management from account settings', () => {
    const settings = source('src/app/(app)/settings/page.tsx');

    expect(settings).toContain('href="/settings/phone"');
  });
});
