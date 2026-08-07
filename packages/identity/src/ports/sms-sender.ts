import type { PhoneOtpPurpose } from '../domain/phone-otp-types';

export interface SmsOtpMessage {
  readonly to: string;
  readonly code: string;
  readonly locale: 'fa' | 'en';
  readonly purpose: PhoneOtpPurpose;
  readonly expiresAt: Date;
}

export interface SmsSender {
  sendOtp(message: SmsOtpMessage): Promise<void>;
}
