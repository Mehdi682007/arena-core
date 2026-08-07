import { describe, expect, it } from 'vitest';
import type { Clock } from '../ports/crypto';
import type { OtpCodeGenerator } from '../ports/otp-code-generator';
import type {
  CreatePhoneOtpChallengeInput,
  PhoneIdentityRepository,
  PhoneIdentityTransactionManager,
} from '../ports/phone-identity-repository';
import type { SmsOtpMessage, SmsSender } from '../ports/sms-sender';
import { NodePhoneOtpHasher } from '../infrastructure/node-phone-otp-hasher';
import type {
  PhoneOtpChallengeRecord,
  VerifiedPhoneIdentityRecord,
} from '../domain/phone-otp-types';
import { IdentityError } from '../domain/identity-errors';
import { PhoneOtpService } from './phone-otp-service';

class FixedClock implements Clock {
  public constructor(public current = new Date('2026-08-08T00:00:00.000Z')) {}
  public now(): Date {
    return new Date(this.current);
  }
}

class FixedCodeGenerator implements OtpCodeGenerator {
  public generateNumericCode(): string {
    return '123456';
  }
}

class CapturingSmsSender implements SmsSender {
  public readonly messages: SmsOtpMessage[] = [];
  public async sendOtp(message: SmsOtpMessage): Promise<void> {
    this.messages.push(message);
  }
}

class MemoryPhoneRepository implements PhoneIdentityRepository {
  public readonly identities = new Map<string, VerifiedPhoneIdentityRecord>();
  public readonly challenges: PhoneOtpChallengeRecord[] = [];
  public verifiedForUser: { userId: string; phoneE164: string } | null = null;

  public async findVerifiedPhoneIdentity(
    phoneE164: string,
  ): Promise<VerifiedPhoneIdentityRecord | null> {
    return this.identities.get(phoneE164) ?? null;
  }

  public async phoneOwnedByOtherUser(phoneE164: string, userId: string): Promise<boolean> {
    const identity = this.identities.get(phoneE164);
    return identity !== undefined && identity.userId !== userId;
  }

  public async findLatestActiveChallenge(input: {
    userId: string | null;
    phoneE164: string;
    purpose: PhoneOtpChallengeRecord['purpose'];
    now: Date;
  }): Promise<PhoneOtpChallengeRecord | null> {
    return (
      [...this.challenges]
        .reverse()
        .find(
          (challenge) =>
            challenge.phoneE164 === input.phoneE164 &&
            challenge.purpose === input.purpose &&
            (input.userId === null || challenge.userId === input.userId) &&
            challenge.consumedAt === null &&
            challenge.expiresAt > input.now,
        ) ?? null
    );
  }

  public async consumeActiveChallenges(input: {
    userId: string | null;
    phoneE164: string;
    purpose: PhoneOtpChallengeRecord['purpose'];
    at: Date;
  }): Promise<void> {
    for (const challenge of this.challenges) {
      if (
        challenge.phoneE164 === input.phoneE164 &&
        challenge.purpose === input.purpose &&
        (input.userId === null || challenge.userId === input.userId) &&
        challenge.consumedAt === null
      ) {
        this.replaceChallenge(challenge.id, { consumedAt: input.at });
      }
    }
  }

  public async createChallenge(input: CreatePhoneOtpChallengeInput): Promise<{ id: string }> {
    const id = `challenge-${String(this.challenges.length + 1)}`;
    this.challenges.push({
      id,
      userId: input.userId,
      phoneE164: input.phoneE164,
      purpose: input.purpose,
      codeHash: input.codeHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      resendAvailableAt: input.resendAvailableAt,
      consumedAt: null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts,
    });
    return { id };
  }

  public async findChallenge(challengeId: string): Promise<PhoneOtpChallengeRecord | null> {
    return this.challenges.find((challenge) => challenge.id === challengeId) ?? null;
  }

  public async recordChallengeFailure(challengeId: string, attemptCount: number): Promise<void> {
    this.replaceChallenge(challengeId, { attemptCount });
  }

  public async consumeChallenge(challengeId: string, at: Date): Promise<void> {
    this.replaceChallenge(challengeId, { consumedAt: at });
  }

  public async verifyPhoneAndConsumeChallenge(input: {
    challengeId: string;
    userId: string;
    phoneE164: string;
    at: Date;
  }): Promise<void> {
    this.verifiedForUser = { userId: input.userId, phoneE164: input.phoneE164 };
    await this.consumeChallenge(input.challengeId, input.at);
  }

  private replaceChallenge(
    challengeId: string,
    patch: Partial<PhoneOtpChallengeRecord>,
  ): void {
    const index = this.challenges.findIndex((challenge) => challenge.id === challengeId);
    if (index === -1) return;
    this.challenges[index] = { ...this.challenges[index]!, ...patch };
  }
}

class MemoryTransactions implements PhoneIdentityTransactionManager {
  public constructor(public readonly repository: MemoryPhoneRepository) {}
  public transaction<T>(operation: (repository: PhoneIdentityRepository) => Promise<T>): Promise<T> {
    return operation(this.repository);
  }
}

function fixture() {
  const repository = new MemoryPhoneRepository();
  const transactions = new MemoryTransactions(repository);
  const clock = new FixedClock();
  const sms = new CapturingSmsSender();
  const service = new PhoneOtpService({
    policy: { digits: 6, ttlSeconds: 300, resendCooldownSeconds: 60, maxAttempts: 3 },
    clock,
    codeGenerator: new FixedCodeGenerator(),
    hasher: new NodePhoneOtpHasher('0123456789abcdef0123456789abcdef'),
    transactions,
    smsSender: sms,
  });
  return { service, repository, clock, sms };
}

const verifiedIdentity: VerifiedPhoneIdentityRecord = {
  userPhoneId: 'phone-1',
  userId: 'user-1',
  phoneE164: '+989121234567',
  verifiedAt: new Date('2026-08-01T00:00:00.000Z'),
  userStatus: 'ACTIVE',
  deletedAt: null,
  securityVersion: 7,
};

describe('PhoneOtpService', () => {
  it('does not reveal an unknown phone and does not dispatch sms', async () => {
    const { service, sms } = fixture();
    await expect(
      service.requestSignInCode({ phone: '+989121234567', locale: 'fa' }),
    ).resolves.toEqual({ accepted: true });
    expect(sms.messages).toHaveLength(0);
  });

  it('dispatches and confirms a sign-in code for a verified active phone', async () => {
    const { service, repository, sms } = fixture();
    repository.identities.set(verifiedIdentity.phoneE164, verifiedIdentity);

    await service.requestSignInCode({ phone: '+98 912 123 4567', locale: 'fa' });
    expect(sms.messages).toHaveLength(1);
    expect(sms.messages[0]).toMatchObject({
      to: '+989121234567',
      code: '123456',
      purpose: 'SIGN_IN',
    });

    await expect(
      service.confirmSignInCode({ phone: '+989121234567', code: '123456' }),
    ).resolves.toEqual({ userId: 'user-1', securityVersion: 7 });
    expect(repository.challenges[0]?.consumedAt).not.toBeNull();
  });

  it('consumes the challenge after the configured number of failed attempts', async () => {
    const { service, repository } = fixture();
    repository.identities.set(verifiedIdentity.phoneE164, verifiedIdentity);
    await service.requestSignInCode({ phone: verifiedIdentity.phoneE164, locale: 'en' });

    await expect(
      service.confirmSignInCode({ phone: verifiedIdentity.phoneE164, code: '000000' }),
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(
      service.confirmSignInCode({ phone: verifiedIdentity.phoneE164, code: '000000' }),
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(
      service.confirmSignInCode({ phone: verifiedIdentity.phoneE164, code: '000000' }),
    ).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' });
    expect(repository.challenges[0]?.consumedAt).not.toBeNull();
  });

  it('verifies an authenticated user phone and enforces resend cooldown', async () => {
    const { service, repository } = fixture();

    await service.requestPhoneVerification({
      userId: 'user-1',
      phone: '+989121234567',
      locale: 'fa',
    });
    await expect(
      service.requestPhoneVerification({
        userId: 'user-1',
        phone: '+989121234567',
        locale: 'fa',
      }),
    ).rejects.toMatchObject({ code: 'OTP_RESEND_TOO_SOON' });

    await service.confirmPhoneVerification({
      userId: 'user-1',
      phone: '+989121234567',
      code: '123456',
    });
    expect(repository.verifiedForUser).toEqual({
      userId: 'user-1',
      phoneE164: '+989121234567',
    });
  });

  it('rejects verification when a phone belongs to another user', async () => {
    const { service, repository } = fixture();
    repository.identities.set(verifiedIdentity.phoneE164, verifiedIdentity);

    await expect(
      service.requestPhoneVerification({
        userId: 'user-2',
        phone: verifiedIdentity.phoneE164,
        locale: 'en',
      }),
    ).rejects.toBeInstanceOf(IdentityError);
  });
});
