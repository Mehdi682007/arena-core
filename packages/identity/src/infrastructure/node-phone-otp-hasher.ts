import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PhoneOtpHashContext, PhoneOtpHasher } from '../ports/phone-otp-hasher';

export class NodePhoneOtpHasher implements PhoneOtpHasher {
  public constructor(private readonly secret: string) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new RangeError('Phone OTP hashing secret must contain at least 32 bytes.');
    }
  }

  public hashCode(context: PhoneOtpHashContext, code: string): string {
    return createHmac('sha256', this.secret)
      .update(context.purpose)
      .update('\0')
      .update(context.phoneE164)
      .update('\0')
      .update(code)
      .digest('base64url');
  }

  public verifyCode(context: PhoneOtpHashContext, code: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashCode(context, code), 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
