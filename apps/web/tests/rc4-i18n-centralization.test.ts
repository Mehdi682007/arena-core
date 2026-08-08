import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rc4MessagesFor } from '../src/i18n/rc4-messages';

const root = path.resolve(import.meta.dirname, '..');

function source(file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

const centralizedFiles = [
  'src/features/auth/login-methods.tsx',
  'src/features/auth/phone-login-form.tsx',
  'src/features/settings/phone-manager.tsx',
  'src/features/settings/game-account-manager.tsx',
  'src/app/(app)/settings/phone/page.tsx',
  'src/app/(app)/settings/sessions/page.tsx',
  'src/app/(app)/settings/game-accounts/page.tsx',
] as const;

describe('RC4 centralized i18n', () => {
  it('provides both Persian and English RC4 catalogs', () => {
    expect(rc4MessagesFor('fa').loginMethods.email).toBe('ایمیل و گذرواژه');

    expect(rc4MessagesFor('en').loginMethods.email).toBe('Email & password');

    expect(rc4MessagesFor('fa').settings.phone).toBe('شماره موبایل');

    expect(rc4MessagesFor('en').settings.phone).toBe('Mobile numbers');
  });

  it.each(centralizedFiles)('keeps translated UI copy out of %s', (file) => {
    const value = source(file);

    expect(value).not.toMatch(/[\u0600-\u06ff]/);

    expect(value).toContain('rc4MessagesFor');
  });

  it('removes local translation functions from managers', () => {
    expect(source('src/features/auth/phone-login-form.tsx')).not.toContain('function text(locale');

    expect(source('src/features/settings/phone-manager.tsx')).not.toContain('function text(locale');

    expect(source('src/features/settings/game-account-manager.tsx')).not.toContain(
      'function text(locale',
    );

    expect(source('src/features/settings/session-manager.tsx')).not.toContain(
      'function sessionText',
    );
  });

  it('preserves phone MFA login integration', () => {
    const phoneLogin = source('src/features/auth/phone-login-form.tsx');

    expect(phoneLogin).toContain('<MfaLoginChallenge');

    expect(phoneLogin).toContain('loginResult.mfaRequired === true');

    expect(phoneLogin).toContain("'/auth/phone/sign-in/confirm'");
  });
});
