import { IdentityError } from './identity-errors';

const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export interface NormalizedPhoneNumber {
  readonly e164: string;
}

export function normalizePhoneE164(value: string): NormalizedPhoneNumber {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  if (!E164_PATTERN.test(normalized)) {
    throw new IdentityError('INVALID_PHONE');
  }
  return Object.freeze({ e164: normalized });
}

export function maskPhoneE164(value: string): string {
  const { e164 } = normalizePhoneE164(value);
  if (e164.length <= 7) return `${e164.slice(0, 3)}***`;
  return `${e164.slice(0, 4)}${'*'.repeat(Math.max(4, e164.length - 8))}${e164.slice(-4)}`;
}
