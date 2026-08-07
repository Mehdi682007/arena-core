import type {
  PhoneOtpChallengeRecord,
  PhoneOtpPurpose,
  VerifiedPhoneIdentityRecord,
} from '../domain/phone-otp-types';

export interface CreatePhoneOtpChallengeInput {
  readonly userId: string | null;
  readonly phoneE164: string;
  readonly purpose: PhoneOtpPurpose;
  readonly codeHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly resendAvailableAt: Date;
  readonly maxAttempts: number;
}

export interface PhoneIdentityRepository {
  findVerifiedPhoneIdentity(phoneE164: string): Promise<VerifiedPhoneIdentityRecord | null>;
  phoneOwnedByOtherUser(phoneE164: string, userId: string): Promise<boolean>;
  findLatestActiveChallenge(input: {
    userId: string | null;
    phoneE164: string;
    purpose: PhoneOtpPurpose;
    now: Date;
  }): Promise<PhoneOtpChallengeRecord | null>;
  consumeActiveChallenges(input: {
    userId: string | null;
    phoneE164: string;
    purpose: PhoneOtpPurpose;
    at: Date;
  }): Promise<void>;
  createChallenge(input: CreatePhoneOtpChallengeInput): Promise<{ id: string }>;
  findChallenge(challengeId: string): Promise<PhoneOtpChallengeRecord | null>;
  recordChallengeFailure(challengeId: string, attemptCount: number): Promise<void>;
  consumeChallenge(challengeId: string, at: Date): Promise<void>;
  verifyPhoneAndConsumeChallenge(input: {
    challengeId: string;
    userId: string;
    phoneE164: string;
    at: Date;
  }): Promise<void>;
}

export interface PhoneIdentityTransactionManager {
  transaction<T>(operation: (repository: PhoneIdentityRepository) => Promise<T>): Promise<T>;
}
