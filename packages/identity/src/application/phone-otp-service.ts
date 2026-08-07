import { IdentityError } from '../domain/identity-errors';
import { normalizePhoneE164 } from '../domain/phone-policies';
import type { PhoneOtpChallengeRecord, PhoneOtpPurpose } from '../domain/phone-otp-types';
import type { Clock } from '../ports/crypto';
import type { OtpCodeGenerator } from '../ports/otp-code-generator';
import type { PhoneIdentityTransactionManager } from '../ports/phone-identity-repository';
import type { PhoneOtpHasher } from '../ports/phone-otp-hasher';
import type { SmsSender } from '../ports/sms-sender';

export interface PhoneOtpPolicy {
  readonly digits: number;
  readonly ttlSeconds: number;
  readonly resendCooldownSeconds: number;
  readonly maxAttempts: number;
}

export interface PhoneOtpDependencies {
  readonly policy: PhoneOtpPolicy;
  readonly clock: Clock;
  readonly codeGenerator: OtpCodeGenerator;
  readonly hasher: PhoneOtpHasher;
  readonly transactions: PhoneIdentityTransactionManager;
  readonly smsSender: SmsSender;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function ensurePolicy(policy: PhoneOtpPolicy): void {
  if (!Number.isSafeInteger(policy.digits) || policy.digits < 4 || policy.digits > 9) {
    throw new RangeError('Phone OTP digits must be an integer between 4 and 9.');
  }
  if (!Number.isSafeInteger(policy.ttlSeconds) || policy.ttlSeconds < 30) {
    throw new RangeError('Phone OTP TTL must be at least 30 seconds.');
  }
  if (!Number.isSafeInteger(policy.resendCooldownSeconds) || policy.resendCooldownSeconds < 1) {
    throw new RangeError('Phone OTP resend cooldown must be a positive integer.');
  }
  if (!Number.isSafeInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 20) {
    throw new RangeError('Phone OTP max attempts must be between 1 and 20.');
  }
}

function ensureActiveIdentity(identity: {
  readonly userStatus: string;
  readonly deletedAt: Date | null;
}): void {
  if (identity.userStatus !== 'ACTIVE' || identity.deletedAt !== null) {
    throw new IdentityError('ACCOUNT_NOT_ACTIVE');
  }
}

export class PhoneOtpService {
  public constructor(private readonly dependencies: PhoneOtpDependencies) {
    ensurePolicy(dependencies.policy);
  }

  public async requestSignInCode(input: {
    phone: string;
    locale: 'fa' | 'en';
  }): Promise<{ accepted: true }> {
    const { e164 } = normalizePhoneE164(input.phone);
    const identity = await this.dependencies.transactions.transaction((repository) =>
      repository.findVerifiedPhoneIdentity(e164),
    );

    if (identity === null || identity.userStatus !== 'ACTIVE' || identity.deletedAt !== null) {
      return Object.freeze({ accepted: true as const });
    }

    try {
      await this.issueChallenge({
        userId: identity.userId,
        phoneE164: e164,
        purpose: 'SIGN_IN',
        locale: input.locale,
        revealCooldown: false,
      });
    } catch {
      // Public sign-in requests stay enumeration-safe even when SMS delivery fails.
    }

    return Object.freeze({ accepted: true as const });
  }

  public async confirmSignInCode(input: {
    phone: string;
    code: string;
  }): Promise<{ userId: string; securityVersion: number }> {
    const { e164 } = normalizePhoneE164(input.phone);
    this.validateCodeShape(input.code);
    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const challenge = await repository.findLatestActiveChallenge({
        userId: null,
        phoneE164: e164,
        purpose: 'SIGN_IN',
        now,
      });
      if (challenge === null || challenge.userId === null) throw new IdentityError('OTP_INVALID');

      await this.verifyChallenge(repository, challenge, input.code, now);

      const identity = await repository.findVerifiedPhoneIdentity(e164);
      if (identity === null || identity.userId !== challenge.userId) {
        throw new IdentityError('OTP_INVALID');
      }
      ensureActiveIdentity(identity);
      await repository.consumeChallenge(challenge.id, now);
      return Object.freeze({
        userId: identity.userId,
        securityVersion: identity.securityVersion,
      });
    });
  }

  public async requestPhoneVerification(input: {
    userId: string;
    phone: string;
    locale: 'fa' | 'en';
  }): Promise<{ accepted: true }> {
    const { e164 } = normalizePhoneE164(input.phone);
    const ownedByOther = await this.dependencies.transactions.transaction((repository) =>
      repository.phoneOwnedByOtherUser(e164, input.userId),
    );
    if (ownedByOther) throw new IdentityError('PHONE_ALREADY_REGISTERED');

    await this.issueChallenge({
      userId: input.userId,
      phoneE164: e164,
      purpose: 'VERIFY_PHONE',
      locale: input.locale,
      revealCooldown: true,
    });
    return Object.freeze({ accepted: true as const });
  }

  public async confirmPhoneVerification(input: {
    userId: string;
    phone: string;
    code: string;
  }): Promise<void> {
    const { e164 } = normalizePhoneE164(input.phone);
    this.validateCodeShape(input.code);
    const now = this.dependencies.clock.now();

    await this.dependencies.transactions.transaction(async (repository) => {
      if (await repository.phoneOwnedByOtherUser(e164, input.userId)) {
        throw new IdentityError('PHONE_ALREADY_REGISTERED');
      }
      const challenge = await repository.findLatestActiveChallenge({
        userId: input.userId,
        phoneE164: e164,
        purpose: 'VERIFY_PHONE',
        now,
      });
      if (challenge === null || challenge.userId !== input.userId) {
        throw new IdentityError('OTP_INVALID');
      }
      await this.verifyChallenge(repository, challenge, input.code, now);
      await repository.verifyPhoneAndConsumeChallenge({
        challengeId: challenge.id,
        userId: input.userId,
        phoneE164: e164,
        at: now,
      });
    });
  }

  private async issueChallenge(input: {
    userId: string;
    phoneE164: string;
    purpose: PhoneOtpPurpose;
    locale: 'fa' | 'en';
    revealCooldown: boolean;
  }): Promise<void> {
    const now = this.dependencies.clock.now();
    const code = this.dependencies.codeGenerator.generateNumericCode(this.dependencies.policy.digits);
    const codeHash = this.dependencies.hasher.hashCode(
      { phoneE164: input.phoneE164, purpose: input.purpose },
      code,
    );
    const expiresAt = addSeconds(now, this.dependencies.policy.ttlSeconds);
    const resendAvailableAt = addSeconds(now, this.dependencies.policy.resendCooldownSeconds);

    const created = await this.dependencies.transactions.transaction(async (repository) => {
      const active = await repository.findLatestActiveChallenge({
        userId: input.userId,
        phoneE164: input.phoneE164,
        purpose: input.purpose,
        now,
      });
      if (active !== null && active.resendAvailableAt > now) {
        if (input.revealCooldown) throw new IdentityError('OTP_RESEND_TOO_SOON');
        return null;
      }
      await repository.consumeActiveChallenges({
        userId: input.userId,
        phoneE164: input.phoneE164,
        purpose: input.purpose,
        at: now,
      });
      return repository.createChallenge({
        userId: input.userId,
        phoneE164: input.phoneE164,
        purpose: input.purpose,
        codeHash,
        createdAt: now,
        expiresAt,
        resendAvailableAt,
        maxAttempts: this.dependencies.policy.maxAttempts,
      });
    });

    if (created === null) return;

    try {
      await this.dependencies.smsSender.sendOtp({
        to: input.phoneE164,
        code,
        locale: input.locale,
        purpose: input.purpose,
        expiresAt,
      });
    } catch (error) {
      await this.dependencies.transactions.transaction((repository) =>
        repository.consumeChallenge(created.id, this.dependencies.clock.now()),
      );
      throw error;
    }
  }

  private async verifyChallenge(
    repository: Parameters<Parameters<PhoneIdentityTransactionManager['transaction']>[0]>[0],
    challenge: PhoneOtpChallengeRecord,
    code: string,
    now: Date,
  ): Promise<void> {
    if (challenge.consumedAt !== null) throw new IdentityError('OTP_CONSUMED');
    if (challenge.expiresAt <= now) {
      await repository.consumeChallenge(challenge.id, now);
      throw new IdentityError('OTP_EXPIRED');
    }
    if (challenge.attemptCount >= challenge.maxAttempts) {
      await repository.consumeChallenge(challenge.id, now);
      throw new IdentityError('OTP_ATTEMPTS_EXCEEDED');
    }

    const valid = this.dependencies.hasher.verifyCode(
      { phoneE164: challenge.phoneE164, purpose: challenge.purpose },
      code,
      challenge.codeHash,
    );
    if (valid) return;

    const attempts = challenge.attemptCount + 1;
    await repository.recordChallengeFailure(challenge.id, attempts);
    if (attempts >= challenge.maxAttempts) {
      await repository.consumeChallenge(challenge.id, now);
      throw new IdentityError('OTP_ATTEMPTS_EXCEEDED');
    }
    throw new IdentityError('OTP_INVALID');
  }

  private validateCodeShape(code: string): void {
    const expected = this.dependencies.policy.digits;
    if (!new RegExp(`^[0-9]{${String(expected)}}$`).test(code)) {
      throw new IdentityError('OTP_INVALID');
    }
  }
}
