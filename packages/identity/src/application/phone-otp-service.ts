import { IdentityError } from '../domain/identity-errors';
import { normalizePhoneE164 } from '../domain/phone-identity-policies';
import type { PhoneOtpPurpose, UserPhoneView } from '../domain/phone-identity-types';
import { normalizeIp } from '../domain/identity-policies';
import type { Clock, TokenService } from '../ports/crypto';
import type {
  PhoneIdentityRepository,
  PhoneIdentityTransactionManager,
} from '../ports/phone-identity-repository';
import type { PhoneOtpCodeGenerator } from '../ports/phone-otp-code-generator';

const otpDigits = 6;
const otpTtlSeconds = 300;
const otpMaxAttempts = 5;

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function active(status: string, deletedAt: Date | null): boolean {
  return status === 'ACTIVE' && deletedAt === null;
}

export interface PhoneOtpIssue {
  readonly challengeId: string;
  readonly purpose: PhoneOtpPurpose;
  readonly expiresAt: Date;
  readonly delivery?: Readonly<{
    to: string;
    code: string;
  }>;
}

export class PhoneOtpService {
  public constructor(
    private readonly dependencies: Readonly<{
      tokenService: TokenService;
      codeGenerator: PhoneOtpCodeGenerator;
      clock: Clock;
      transactions: PhoneIdentityTransactionManager;
    }>,
  ) {}

  public async requestSignIn(input: {
    phone: string;
    requestedIp?: string;
  }): Promise<PhoneOtpIssue> {
    const phoneE164 = normalizePhoneE164(input.phone);

    const code = this.dependencies.codeGenerator.generate(otpDigits);

    const codeHash = this.dependencies.tokenService.hashToken('phone-otp', code);

    const now = this.dependencies.clock.now();

    const expiresAt = addSeconds(now, otpTtlSeconds);

    const requestedIp = normalizeIp(input.requestedIp);

    return this.dependencies.transactions.transaction(async (repository) => {
      const phone = await repository.findVerifiedPhoneByE164(phoneE164);

      const eligible = phone !== null && active(phone.user.status, phone.user.deletedAt);

      const challenge = await repository.createOtpChallenge({
        ...(eligible
          ? {
              userId: phone.userId,
              userPhoneId: phone.id,
            }
          : {}),
        phoneE164,
        purpose: 'SIGN_IN',
        codeHash,
        expiresAt,
        maxAttempts: otpMaxAttempts,
        ...(requestedIp === undefined
          ? {}
          : {
              requestedIpHash: this.dependencies.tokenService.hashIp(requestedIp),
            }),
      });

      return Object.freeze({
        challengeId: challenge.id,
        purpose: 'SIGN_IN' as const,
        expiresAt,
        ...(eligible
          ? {
              delivery: Object.freeze({
                to: phoneE164,
                code,
              }),
            }
          : {}),
      });
    });
  }

  public async confirmSignIn(input: { challengeId: string; code: string }): Promise<{
    userId: string;
    securityVersion: number;
  }> {
    const suppliedHash = this.dependencies.tokenService.hashToken('phone-otp', input.code);

    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const challenge = await repository.findOtpChallenge(input.challengeId);

      if (
        challenge === null ||
        challenge.purpose !== 'SIGN_IN' ||
        challenge.consumedAt !== null ||
        challenge.expiresAt <= now ||
        challenge.attemptCount >= challenge.maxAttempts
      ) {
        throw new IdentityError('INVALID_PHONE_OTP');
      }

      const validCode =
        /^\d{6}$/.test(input.code) &&
        this.dependencies.tokenService.constantTimeEqual(suppliedHash, challenge.codeHash);

      const phone = challenge.userPhone;

      const validIdentity =
        phone !== null &&
        phone.verifiedAt !== null &&
        active(phone.user.status, phone.user.deletedAt);

      if (!validCode || !validIdentity) {
        await repository.recordOtpFailure(challenge.id);

        throw new IdentityError('INVALID_PHONE_OTP');
      }

      if (!(await repository.consumeOtpChallenge(challenge.id, now))) {
        throw new IdentityError('INVALID_PHONE_OTP');
      }

      return Object.freeze({
        userId: phone.userId,
        securityVersion: phone.user.securityVersion,
      });
    });
  }

  public async requestVerification(input: {
    userId: string;
    phone: string;
    requestedIp?: string;
  }): Promise<PhoneOtpIssue> {
    const phoneE164 = normalizePhoneE164(input.phone);

    const code = this.dependencies.codeGenerator.generate(otpDigits);

    const codeHash = this.dependencies.tokenService.hashToken('phone-otp', code);

    const now = this.dependencies.clock.now();

    const expiresAt = addSeconds(now, otpTtlSeconds);

    const requestedIp = normalizeIp(input.requestedIp);

    return this.dependencies.transactions.transaction(async (repository) => {
      const user = await repository.findUser(input.userId);

      if (user === null || !active(user.status, user.deletedAt)) {
        throw new IdentityError('ACCOUNT_NOT_ACTIVE');
      }

      const existing = await repository.findPhoneByE164(phoneE164);

      const canDeliver = existing === null || existing.userId === input.userId;

      const challenge = await repository.createOtpChallenge({
        userId: input.userId,
        ...(existing !== null && existing.userId === input.userId
          ? {
              userPhoneId: existing.id,
            }
          : {}),
        phoneE164,
        purpose: 'VERIFY_PHONE',
        codeHash,
        expiresAt,
        maxAttempts: otpMaxAttempts,
        ...(requestedIp === undefined
          ? {}
          : {
              requestedIpHash: this.dependencies.tokenService.hashIp(requestedIp),
            }),
      });

      return Object.freeze({
        challengeId: challenge.id,
        purpose: 'VERIFY_PHONE' as const,
        expiresAt,
        ...(canDeliver
          ? {
              delivery: Object.freeze({
                to: phoneE164,
                code,
              }),
            }
          : {}),
      });
    });
  }

  public async confirmVerification(input: {
    userId: string;
    challengeId: string;
    code: string;
  }): Promise<UserPhoneView> {
    const suppliedHash = this.dependencies.tokenService.hashToken('phone-otp', input.code);

    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const challenge = await repository.findOtpChallenge(input.challengeId);

      if (
        challenge === null ||
        challenge.purpose !== 'VERIFY_PHONE' ||
        challenge.userId !== input.userId ||
        challenge.consumedAt !== null ||
        challenge.expiresAt <= now ||
        challenge.attemptCount >= challenge.maxAttempts
      ) {
        throw new IdentityError('INVALID_PHONE_OTP');
      }

      const validCode =
        /^\d{6}$/.test(input.code) &&
        this.dependencies.tokenService.constantTimeEqual(suppliedHash, challenge.codeHash);

      if (!validCode) {
        await repository.recordOtpFailure(challenge.id);

        throw new IdentityError('INVALID_PHONE_OTP');
      }

      return repository.verifyPhoneAndConsumeChallenge({
        challengeId: challenge.id,
        userId: input.userId,
        phoneE164: challenge.phoneE164,
        at: now,
      });
    });
  }

  public listUserPhones(userId: string): Promise<readonly UserPhoneView[]> {
    return this.dependencies.transactions.transaction((repository: PhoneIdentityRepository) =>
      repository.listUserPhones(userId),
    );
  }
}
