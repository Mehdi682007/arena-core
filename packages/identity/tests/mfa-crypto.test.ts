import { describe, expect, it } from 'vitest';
import { NodeMfaCrypto } from '../src';

function requireDefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined.');
  }

  return value;
}

const crypto = new NodeMfaCrypto('mfa-test-master-key-with-at-least-32-characters');

describe('MFA crypto', () => {
  it('encrypts and restores TOTP secrets', () => {
    const secret = crypto.generateTotpSecret();

    const sealed = crypto.sealTotpSecret(secret);

    expect(sealed.ciphertext).not.toContain(secret);

    expect(crypto.openTotpSecret(sealed)).toBe(secret);
  });

  it('produces and validates RFC6238-style TOTP codes', () => {
    const secret = crypto.generateTotpSecret();

    const now = new Date('2026-08-08T01:00:00Z');

    const code = crypto.totp(secret, now);

    expect(code).toMatch(/^[0-9]{6}$/);

    expect(crypto.verifyTotp(secret, code, now)).toBe(true);

    const replacement = code.endsWith('0') ? '1' : '0';

    const invalid = `${code.slice(0, 5)}${replacement}`;

    expect(crypto.verifyTotp(secret, invalid, now)).toBe(false);
  });

  it('creates unique recovery codes and stores only hashes', () => {
    const codes = crypto.generateRecoveryCodes(10);

    expect(codes).toHaveLength(10);

    expect(new Set(codes).size).toBe(10);

    expect(crypto.hashRecoveryCode(requireDefined(codes[0]))).not.toContain(
      requireDefined(codes[0]),
    );
  });
});
