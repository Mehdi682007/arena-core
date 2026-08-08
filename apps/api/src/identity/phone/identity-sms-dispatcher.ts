import { Injectable } from '@nestjs/common';
import type { Locale } from '@arena-core/config';
import type { PhoneOtpPurpose } from '@arena-core/identity';

export interface IdentitySmsDispatcher {
  sendOtp(input: {
    to: string;
    code: string;
    locale: Locale;
    purpose: PhoneOtpPurpose;
    expiresAt: Date;
  }): Promise<void>;
}

export const IDENTITY_SMS_DISPATCHER = Symbol('IDENTITY_SMS_DISPATCHER');

@Injectable()
export class DisabledIdentitySmsDispatcher implements IdentitySmsDispatcher {
  public sendOtp(): Promise<void> {
    return Promise.reject(new Error('SMS_DELIVERY_DISABLED'));
  }
}
