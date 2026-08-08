import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rc4MessagesFor } from '../src/i18n/rc4-messages';

const root = path.resolve(import.meta.dirname, '..');

function walk(directory: string): string[] {
  const result: string[] = [];

  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(absolute));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.tsx') && absolute.toLowerCase().includes('mfa')) {
      result.push(absolute);
    }
  }

  return result;
}

function source(file: string): string {
  return readFileSync(file, 'utf8');
}

describe('RC4 MFA centralized i18n', () => {
  const files = walk(path.join(root, 'src'));

  it('has MFA messages in both locales', () => {
    const fa = rc4MessagesFor('fa').mfa;

    const en = rc4MessagesFor('en').mfa;

    expect(Object.keys(fa).length).toBeGreaterThan(0);

    expect(Object.keys(en)).toEqual(Object.keys(fa));
  });

  it('removes Persian copy from MFA TSX sources', () => {
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(source(file)).not.toMatch(/[\u0600-\u06ff]/u);
    }
  });

  it('keeps MFA challenge tokens out of browser storage', () => {
    const challenge = source(path.join(root, 'src', 'features', 'auth', 'mfa-login-challenge.tsx'));

    expect(challenge).not.toContain('localStorage');

    expect(challenge).not.toContain('sessionStorage');

    expect(challenge).toContain('/auth/mfa/challenge/confirm');
  });

  it('keeps both login completion paths wired to the shared challenge', () => {
    const email = source(path.join(root, 'src', 'features', 'auth', 'auth-form.tsx'));

    const phone = source(path.join(root, 'src', 'features', 'auth', 'phone-login-form.tsx'));

    expect(email).toContain('<MfaLoginChallenge');

    expect(phone).toContain('<MfaLoginChallenge');

    expect(email).toContain('mfaChallengeToken');

    expect(phone).toContain('mfaChallengeToken');
  });
});
