import { describe, expect, it } from 'vitest';
import { NodePhoneOtpHasher } from './node-phone-otp-hasher';

describe('NodePhoneOtpHasher', () => {
  const secret = '0123456789abcdef0123456789abcdef';

  it('verifies a code only in the same phone and purpose context', () => {
    const hasher = new NodePhoneOtpHasher(secret);
    const context = { phoneE164: '+989121234567', purpose: 'SIGN_IN' as const };
    const hash = hasher.hashCode(context, '123456');

    expect(hasher.verifyCode(context, '123456', hash)).toBe(true);
    expect(hasher.verifyCode(context, '654321', hash)).toBe(false);
    expect(
      hasher.verifyCode({ phoneE164: '+989121234568', purpose: 'SIGN_IN' }, '123456', hash),
    ).toBe(false);
    expect(
      hasher.verifyCode({ phoneE164: '+989121234567', purpose: 'VERIFY_PHONE' }, '123456', hash),
    ).toBe(false);
  });

  it('rejects a weak hashing secret', () => {
    expect(() => new NodePhoneOtpHasher('too-short')).toThrow(RangeError);
  });
});
