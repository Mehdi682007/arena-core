import type { UserSecurityRecord } from './identity-types';

export type PhoneOtpPurpose = 'SIGN_IN' | 'VERIFY_PHONE' | 'CHANGE_PHONE' | 'RECOVERY';

export interface UserPhoneView {
  readonly id: string;
  readonly phoneE164: string;
  readonly isPrimary: boolean;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
}

export interface PhoneIdentityRecord extends UserPhoneView {
  readonly userId: string;
  readonly user: UserSecurityRecord;
}

export interface PhoneOtpChallengeRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly userPhoneId: string | null;
  readonly phoneE164: string;
  readonly purpose: PhoneOtpPurpose;
  readonly codeHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly requestedIpHash: string | null;
  readonly userPhone: PhoneIdentityRecord | null;
}
