import { createApiConfig } from '@arena-core/config';
import { describe, expect, it } from 'vitest';
import {
  IdentityError,
  NodeArgon2PasswordHasher,
  NodeCryptoTokenService,
  normalizeEmail,
  normalizeIp,
  sanitizeUserAgent,
  validatePassword,
} from '../src';

const authentication = createApiConfig(
  { NODE_ENV: 'test' },
  { packageVersion: '0.0.0', actualNodeVersion: process.versions.node },
).authentication;

describe('identity policies', () => {
  it('normalizes casing and Unicode without provider-specific dot or plus rewriting', () => {
    expect(normalizeEmail('  Méhdi.Tag+game@Example.COM ')).toEqual({
      email: 'Méhdi.Tag+game@Example.COM',
      normalizedEmail: 'méhdi.tag+game@example.com',
    });
  });

  it.each(['', 'a@@example.com', '.a@example.com', 'a..b@example.com', 'a@bad domain'])(
    'rejects invalid email %j',
    (email) => {
      expect(() => normalizeEmail(email)).toThrow(IdentityError);
    },
  );

  it('enforces password boundaries and rejects whitespace and NUL', () => {
    expect(validatePassword('correct horse battery', authentication.password)).toContain('horse');
    for (const password of [null, 'short', ' '.repeat(12), `valid-password\0`]) {
      expect(() => validatePassword(password, authentication.password)).toThrow(IdentityError);
    }
  });

  it('normalizes IPs and sanitizes user agents', () => {
    expect(normalizeIp(' ::ffff:192.0.2.1 ')).toBe('192.0.2.1');
    expect(() => normalizeIp('not-an-ip')).toThrow(IdentityError);
    expect(sanitizeUserAgent('Browser\r\nInjected')).toBe('Browser  Injected');
    expect(sanitizeUserAgent('x'.repeat(600))).toHaveLength(512);
  });
});

describe('Node crypto adapters', () => {
  it('hashes and verifies with Argon2id using unique salts', async () => {
    const hasher = new NodeArgon2PasswordHasher(authentication.password);
    const first = await hasher.hash('correct horse battery');
    const second = await hasher.hash('correct horse battery');

    expect(first.algorithm).toBe('argon2id');
    expect(first.encodedHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(first.encodedHash).not.toContain('correct horse battery');
    expect(first.encodedHash).not.toBe(second.encodedHash);
    await expect(hasher.verify('correct horse battery', first.encodedHash)).resolves.toBe(true);
    await expect(hasher.verify('wrong password', first.encodedHash)).resolves.toBe(false);
    await expect(hasher.verify('anything', 'malformed')).resolves.toBe(false);
    expect(hasher.needsRehash(first.encodedHash)).toBe(false);
  });

  it('creates URL-safe opaque tokens and domain-separated HMAC hashes', () => {
    const tokens = new NodeCryptoTokenService(authentication);
    const token = tokens.generateToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokens.generateToken(32)).not.toBe(token);
    expect(tokens.hashToken('session', token)).toHaveLength(64);
    expect(tokens.hashToken('session', token)).not.toBe(tokens.hashToken('password-reset', token));
    expect(tokens.hashIp('192.0.2.1')).not.toBe(tokens.hashToken('session', '192.0.2.1'));
    expect(tokens.constantTimeEqual('same', 'same')).toBe(true);
    expect(tokens.constantTimeEqual('same', 'different')).toBe(false);
  });
});
