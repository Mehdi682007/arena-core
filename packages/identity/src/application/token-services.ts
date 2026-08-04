import type { AuthenticationConfig } from '@arena-core/config';
import { IdentityError } from '../domain/identity-errors';
import { normalizeEmail, normalizeIp, validatePassword } from '../domain/identity-policies';
import type { Clock, PasswordHasher, TokenService } from '../ports/crypto';
import type { IdentityTransactionManager } from '../ports/identity-repository';

export interface TokenServiceDependencies {
  readonly config: AuthenticationConfig;
  readonly passwordHasher: PasswordHasher;
  readonly tokenService: TokenService;
  readonly clock: Clock;
  readonly transactions: IdentityTransactionManager;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

export class EmailVerificationService {
  public constructor(private readonly dependencies: TokenServiceDependencies) {}

  public async issueEmailVerificationToken(input: {
    userId: string;
    emailId: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const email = await this.dependencies.transactions.transaction((repository) =>
      repository.findEmail(input.userId, input.emailId),
    );
    if (email === null) throw new IdentityError('INVALID_TOKEN');
    if (email.verifiedAt !== null) throw new IdentityError('IDENTITY_CONFLICT');
    const token = this.dependencies.tokenService.generateToken(
      this.dependencies.config.emailVerification.tokenBytes,
    );
    const expiresAt = addSeconds(
      this.dependencies.clock.now(),
      this.dependencies.config.emailVerification.ttlSeconds,
    );
    const tokenHash = this.dependencies.tokenService.hashToken('email-verification', token);
    await this.dependencies.transactions.transaction(async (repository) => {
      await repository.consumeActiveVerificationTokens(email.id, this.dependencies.clock.now());
      await repository.createVerificationToken({
        userEmailId: email.id,
        tokenHash,
        expiresAt,
      });
    });
    return Object.freeze({ token, expiresAt });
  }

  public async requestEmailVerification(input: {
    email: string;
  }): Promise<{ accepted: true; email?: string; token?: string; expiresAt?: Date }> {
    const email = normalizeEmail(input.email);
    const identity = await this.dependencies.transactions.transaction((repository) =>
      repository.findVerificationIdentity(email.normalizedEmail),
    );
    if (
      identity === null ||
      identity.verifiedAt !== null ||
      identity.status !== 'PENDING_VERIFICATION'
    ) {
      return Object.freeze({ accepted: true });
    }
    const issued = await this.issueEmailVerificationToken({
      userId: identity.userId,
      emailId: identity.emailId,
    });
    return Object.freeze({ accepted: true, email: identity.email, ...issued });
  }

  public async consumeEmailVerificationToken(token: string): Promise<{ userId: string }> {
    const tokenHash = this.dependencies.tokenService.hashToken('email-verification', token);
    return this.dependencies.transactions.transaction(async (repository) => {
      const record = await repository.findVerificationToken(tokenHash);
      if (record === null || record.consumedAt !== null) throw new IdentityError('INVALID_TOKEN');
      const now = this.dependencies.clock.now();
      if (record.expiresAt <= now) throw new IdentityError('EXPIRED_TOKEN');
      if (record.email.verifiedAt !== null) throw new IdentityError('INVALID_TOKEN');
      await repository.verifyEmailAndConsumeToken(
        record.id,
        record.email.id,
        record.email.userId,
        record.email.isPrimary && record.email.userStatus === 'PENDING_VERIFICATION',
        now,
      );
      await repository.consumeActiveVerificationTokens(record.email.id, now);
      return Object.freeze({ userId: record.email.userId });
    });
  }
}

export class PasswordResetService {
  public constructor(private readonly dependencies: TokenServiceDependencies) {}

  public async issuePasswordResetToken(input: {
    email: string;
    requestedIp?: string;
  }): Promise<{ accepted: true; token?: string; expiresAt?: Date }> {
    const email = normalizeEmail(input.email);
    const identity = await this.dependencies.transactions.transaction((repository) =>
      repository.findResetIdentity(email.normalizedEmail),
    );
    if (identity === null || identity.verifiedAt === null || identity.status !== 'ACTIVE') {
      return Object.freeze({ accepted: true });
    }
    const token = this.dependencies.tokenService.generateToken(
      this.dependencies.config.passwordReset.tokenBytes,
    );
    const expiresAt = addSeconds(
      this.dependencies.clock.now(),
      this.dependencies.config.passwordReset.ttlSeconds,
    );
    const normalizedIp = normalizeIp(input.requestedIp);
    await this.dependencies.transactions.transaction(async (repository) => {
      await repository.consumeActiveResetTokens(identity.userId, this.dependencies.clock.now());
      await repository.createResetToken({
        userId: identity.userId,
        tokenHash: this.dependencies.tokenService.hashToken('password-reset', token),
        expiresAt,
        ...(normalizedIp === undefined
          ? {}
          : { requestedIpHash: this.dependencies.tokenService.hashIp(normalizedIp) }),
      });
    });
    return Object.freeze({ accepted: true, token, expiresAt });
  }

  public async consumePasswordResetToken(input: {
    token: string;
    newPassword: string;
  }): Promise<{ userId: string; securityVersion: number }> {
    validatePassword(input.newPassword, this.dependencies.config.password);
    const next = await this.dependencies.passwordHasher.hash(input.newPassword);
    const tokenHash = this.dependencies.tokenService.hashToken('password-reset', input.token);
    return this.dependencies.transactions.transaction(async (repository) => {
      const record = await repository.findResetToken(tokenHash);
      if (record === null || record.consumedAt !== null) throw new IdentityError('INVALID_TOKEN');
      const now = this.dependencies.clock.now();
      if (record.expiresAt <= now) throw new IdentityError('EXPIRED_TOKEN');
      const securityVersion = await repository.resetPassword({
        tokenId: record.id,
        userId: record.userId,
        passwordHash: next.encodedHash,
        passwordAlgorithm: next.algorithm,
        at: now,
      });
      await repository.consumeActiveResetTokens(record.userId, now);
      await repository.revokeActiveSessions(record.userId, now, 'PASSWORD_RESET');
      return Object.freeze({ userId: record.userId, securityVersion });
    });
  }
}
