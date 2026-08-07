import type { UserStatus } from './identity-types';

export type PhoneOtpPurpose = 'SIGN_IN' | 'VERIFY_PHONE' | 'CHANGE_PHONE' | 'RECOVERY';

export interface PhoneOtpChallengeRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly phoneE164: string;
  readonly purpose: PhoneOtpPurpose;
  readonly codeHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly resendAvailableAt: Date;
  readonly consumedAt: Date | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
}

export interface VerifiedPhoneIdentityRecord {
  readonly userPhoneId: string;
  readonly userId: string;
  readonly phoneE164: string;
  readonly verifiedAt: Date;
  readonly userStatus: UserStatus;
  readonly deletedAt: Date | null;
  readonly securityVersion: number;
}
