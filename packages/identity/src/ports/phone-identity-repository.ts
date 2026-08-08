import type { UserSecurityRecord } from '../domain/identity-types';
import type {
  PhoneIdentityRecord,
  PhoneOtpChallengeRecord,
  PhoneOtpPurpose,
  UserPhoneView,
} from '../domain/phone-identity-types';

export interface PhoneIdentityRepository {
  findUser(userId: string): Promise<UserSecurityRecord | null>;

  findPhoneByE164(phoneE164: string): Promise<PhoneIdentityRecord | null>;

  findVerifiedPhoneByE164(phoneE164: string): Promise<PhoneIdentityRecord | null>;

  listUserPhones(userId: string): Promise<readonly UserPhoneView[]>;

  createOtpChallenge(input: {
    userId?: string;
    userPhoneId?: string;
    phoneE164: string;
    purpose: PhoneOtpPurpose;
    codeHash: string;
    expiresAt: Date;
    maxAttempts: number;
    requestedIpHash?: string;
  }): Promise<{ id: string; createdAt: Date }>;

  findOtpChallenge(challengeId: string): Promise<PhoneOtpChallengeRecord | null>;

  recordOtpFailure(challengeId: string): Promise<void>;

  consumeOtpChallenge(challengeId: string, at: Date): Promise<boolean>;

  verifyPhoneAndConsumeChallenge(input: {
    challengeId: string;
    userId: string;
    phoneE164: string;
    at: Date;
  }): Promise<UserPhoneView>;
}

export interface PhoneIdentityTransactionManager {
  transaction<T>(operation: (repository: PhoneIdentityRepository) => Promise<T>): Promise<T>;
}
