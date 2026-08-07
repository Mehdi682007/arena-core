import { describe, expect, it } from 'vitest';
import { IdentityError } from './identity-errors';
import { maskPhoneE164, normalizePhoneE164 } from './phone-policies';

describe('phone policies', () => {
  it('normalizes an international number to canonical E.164', () => {
    expect(normalizePhoneE164('+98 912-123-4567')).toEqual({ e164: '+989121234567' });
  });

  it('requires an explicit international country code', () => {
    expect(() => normalizePhoneE164('09121234567')).toThrowError(IdentityError);
  });

  it('rejects values beyond E.164 length limits', () => {
    expect(() => normalizePhoneE164('+1234567890123456')).toThrowError(IdentityError);
  });

  it('masks the middle of a phone number for display', () => {
    expect(maskPhoneE164('+989121234567')).toBe('+989****4567');
  });
});
