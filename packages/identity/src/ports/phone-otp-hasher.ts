import type { PhoneOtpPurpose } from '../domain/phone-otp-types';

export interface PhoneOtpHashContext {
  readonly phoneE164: string;
  readonly purpose: PhoneOtpPurpose;
}

export interface PhoneOtpHasher {
  hashCode(context: PhoneOtpHashContext, code: string): string;
  verifyCode(context: PhoneOtpHashContext, code: string, expectedHash: string): boolean;
}
