import { isIP } from 'node:net';
import type { AuthenticationConfig } from '@arena-core/config';
import { IdentityError } from './identity-errors';

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function normalizeEmail(
  input: string,
): Readonly<{ email: string; normalizedEmail: string }> {
  const email = input.trim().normalize('NFC');
  if (email.length === 0 || email.length > 320 || containsControlCharacter(email)) {
    throw new IdentityError('INVALID_EMAIL');
  }
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator !== email.indexOf('@')) throw new IdentityError('INVALID_EMAIL');
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (
    local.length > 64 ||
    domain.length === 0 ||
    domain.length > 255 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !/^[^\s@]+$/u.test(local) ||
    !/^[A-Za-z0-9.-]+$/u.test(domain) ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    throw new IdentityError('INVALID_EMAIL');
  }
  return Object.freeze({ email, normalizedEmail: email.toLowerCase() });
}

export function validatePassword(
  password: unknown,
  config: AuthenticationConfig['password'],
): string {
  if (
    typeof password !== 'string' ||
    password.length < config.minLength ||
    password.length > config.maxLength ||
    password.trim().length === 0 ||
    password.includes('\0')
  ) {
    throw new IdentityError('WEAK_PASSWORD');
  }
  return password;
}

export function normalizeIp(ip: string | undefined): string | undefined {
  if (ip === undefined || ip.trim() === '') return undefined;
  const value = ip.trim().toLowerCase();
  if (isIP(value) === 0) throw new IdentityError('IDENTITY_CONFLICT');
  return value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value;
}

export function sanitizeUserAgent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let sanitized = '';
  for (const character of value) {
    sanitized += containsControlCharacter(character) ? ' ' : character;
  }
  sanitized = sanitized.trim();
  return sanitized.length === 0 ? undefined : sanitized.slice(0, 512);
}
