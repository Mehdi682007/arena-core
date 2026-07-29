import type { AuthenticationConfig } from '@arena-core/config';
import { IdentityError } from '../domain/identity-errors';
import {
  normalizeEmail,
  normalizeIp,
  sanitizeUserAgent,
  validatePassword,
} from '../domain/identity-policies';
import type { Clock, PasswordHasher, TokenService } from '../ports/crypto';
import type { IdentityTransactionManager } from '../ports/identity-repository';

export interface IdentityDependencies {
  readonly config: AuthenticationConfig;
  readonly passwordHasher: PasswordHasher;
  readonly tokenService: TokenService;
  readonly clock: Clock;
  readonly transactions: IdentityTransactionManager;
  readonly dummyPasswordHash: string;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function ensureActive(status: string, deletedAt: Date | null = null): void {
  if (status !== 'ACTIVE' || deletedAt !== null) throw new IdentityError('ACCOUNT_NOT_ACTIVE');
}

export class IdentityService {
  public constructor(private readonly dependencies: IdentityDependencies) {}

  public async registerUser(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: 'fa' | 'en';
    timezone?: string;
    countryCode?: string;
  }): Promise<{
    userId: string;
    emailId: string;
    status: 'PENDING_VERIFICATION';
    verificationToken: string;
    verificationExpiresAt: Date;
  }> {
    const email = normalizeEmail(input.email);
    validatePassword(input.password, this.dependencies.config.password);
    const password = await this.dependencies.passwordHasher.hash(input.password);
    const token = this.dependencies.tokenService.generateToken(
      this.dependencies.config.emailVerification.tokenBytes,
    );
    const tokenHash = this.dependencies.tokenService.hashToken('email-verification', token);
    const expiresAt = addSeconds(
      this.dependencies.clock.now(),
      this.dependencies.config.emailVerification.ttlSeconds,
    );
    const profile =
      input.displayName === undefined
        ? undefined
        : {
            displayName: input.displayName.trim(),
            locale: input.locale ?? 'fa',
            timezone: input.timezone ?? 'UTC',
            ...(input.countryCode === undefined
              ? {}
              : { countryCode: input.countryCode.trim().toUpperCase() }),
          };
    if (profile !== undefined && profile.displayName.length === 0) {
      throw new IdentityError('IDENTITY_CONFLICT');
    }

    const created = await this.dependencies.transactions.transaction(async (repository) => {
      if (await repository.emailExists(email.normalizedEmail)) {
        throw new IdentityError('EMAIL_ALREADY_REGISTERED');
      }
      return repository.createRegistration({
        ...email,
        passwordHash: password.encodedHash,
        passwordAlgorithm: password.algorithm,
        verificationTokenHash: tokenHash,
        verificationExpiresAt: expiresAt,
        ...(profile === undefined ? {} : { profile }),
      });
    });
    return Object.freeze({
      ...created,
      status: 'PENDING_VERIFICATION',
      verificationToken: token,
      verificationExpiresAt: expiresAt,
    });
  }

  public async authenticateWithPassword(input: { email: string; password: string }): Promise<{
    authenticated: true;
    userId: string;
    securityVersion: number;
    passwordRehashed: boolean;
  }> {
    const email = normalizeEmail(input.email);
    const identity = await this.dependencies.transactions.transaction((repository) =>
      repository.findLoginIdentity(email.normalizedEmail),
    );
    const hash = identity?.passwordHash ?? this.dependencies.dummyPasswordHash;
    const verified = await this.dependencies.passwordHasher.verify(input.password, hash);
    if (identity === null || !verified) {
      if (identity !== null) {
        const count = identity.failedAttemptCount + 1;
        const lockedUntil =
          count >= this.dependencies.config.lockout.maxFailedAttempts
            ? addSeconds(this.dependencies.clock.now(), this.dependencies.config.lockout.seconds)
            : null;
        await this.dependencies.transactions.transaction((repository) =>
          repository.recordAuthenticationFailure(identity.id, count, lockedUntil),
        );
      }
      throw new IdentityError('INVALID_CREDENTIALS');
    }
    const now = this.dependencies.clock.now();
    if (identity.lockedUntil !== null && identity.lockedUntil > now) {
      throw new IdentityError('ACCOUNT_LOCKED');
    }
    ensureActive(identity.status, identity.deletedAt);
    const shouldRehash = this.dependencies.passwordHasher.needsRehash(identity.passwordHash);
    const rehash = shouldRehash
      ? await this.dependencies.passwordHasher.hash(input.password)
      : undefined;
    await this.dependencies.transactions.transaction((repository) =>
      repository.recordAuthenticationSuccess(
        identity.id,
        now,
        rehash === undefined
          ? undefined
          : { hash: rehash.encodedHash, algorithm: rehash.algorithm },
      ),
    );
    return Object.freeze({
      authenticated: true,
      userId: identity.id,
      securityVersion: identity.securityVersion,
      passwordRehashed: shouldRehash,
    });
  }

  public async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    excludeSessionId?: string;
  }): Promise<{ securityVersion: number }> {
    validatePassword(input.newPassword, this.dependencies.config.password);
    const credential = await this.dependencies.transactions.transaction((repository) =>
      repository.findCredential(input.userId),
    );
    if (
      credential === null ||
      !(await this.dependencies.passwordHasher.verify(
        input.currentPassword,
        credential.passwordHash,
      ))
    ) {
      throw new IdentityError('INVALID_CREDENTIALS');
    }
    if (await this.dependencies.passwordHasher.verify(input.newPassword, credential.passwordHash)) {
      throw new IdentityError('WEAK_PASSWORD');
    }
    const next = await this.dependencies.passwordHasher.hash(input.newPassword);
    const securityVersion = await this.dependencies.transactions.transaction(async (repository) => {
      const current = await repository.findCredential(input.userId);
      if (current?.passwordHash !== credential.passwordHash) {
        throw new IdentityError('IDENTITY_CONFLICT');
      }
      return repository.changePassword({
        userId: input.userId,
        passwordHash: next.encodedHash,
        passwordAlgorithm: next.algorithm,
        at: this.dependencies.clock.now(),
        ...(input.excludeSessionId === undefined
          ? {}
          : { excludeSessionId: input.excludeSessionId }),
      });
    });
    return Object.freeze({ securityVersion });
  }
}

export class SessionService {
  public constructor(private readonly dependencies: IdentityDependencies) {}

  public async createSession(input: {
    userId: string;
    securityVersion: number;
    ip?: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
    const user = await this.dependencies.transactions.transaction((repository) =>
      repository.findUser(input.userId),
    );
    if (user === null) throw new IdentityError('ACCOUNT_NOT_ACTIVE');
    ensureActive(user.status, user.deletedAt);
    if (user.securityVersion !== input.securityVersion) {
      throw new IdentityError('SESSION_INVALID');
    }
    const now = this.dependencies.clock.now();
    const token = this.dependencies.tokenService.generateToken(
      this.dependencies.config.session.tokenBytes,
    );
    const tokenHash = this.dependencies.tokenService.hashToken('session', token);
    const normalizedIp = normalizeIp(input.ip);
    const userAgent = sanitizeUserAgent(input.userAgent);
    const expiresAt = addSeconds(now, this.dependencies.config.session.ttlSeconds);
    const created = await this.dependencies.transactions.transaction((repository) =>
      repository.createSession({
        userId: user.id,
        tokenHash,
        securityVersion: user.securityVersion,
        status: 'ACTIVE',
        createdAt: now,
        lastSeenAt: null,
        expiresAt,
        ...(normalizedIp === undefined
          ? {}
          : { ipHash: this.dependencies.tokenService.hashIp(normalizedIp) }),
        ...(userAgent === undefined ? {} : { userAgent }),
      }),
    );
    return Object.freeze({ sessionId: created.id, token, expiresAt });
  }

  public async validateSession(token: string): Promise<{
    valid: true;
    userId: string;
    sessionId: string;
  }> {
    const hash = this.dependencies.tokenService.hashToken('session', token);
    const session = await this.dependencies.transactions.transaction((repository) =>
      repository.findSessionByTokenHash(hash),
    );
    if (session === null) throw new IdentityError('SESSION_INVALID');
    if (session.status === 'REVOKED') throw new IdentityError('SESSION_REVOKED');
    const now = this.dependencies.clock.now();
    if (session.status !== 'ACTIVE' || session.expiresAt <= now) {
      throw new IdentityError('SESSION_EXPIRED');
    }
    ensureActive(session.user.status, session.user.deletedAt);
    if (session.securityVersion !== session.user.securityVersion) {
      throw new IdentityError('SESSION_INVALID');
    }
    const idleBase = session.lastSeenAt ?? session.createdAt;
    if (addSeconds(idleBase, this.dependencies.config.session.idleTimeoutSeconds) <= now) {
      throw new IdentityError('SESSION_EXPIRED');
    }
    return Object.freeze({ valid: true, userId: session.userId, sessionId: session.id });
  }

  public async revokeSession(sessionId: string, reason = 'USER_REQUEST'): Promise<void> {
    if (!/^[A-Z0-9_]{1,64}$/.test(reason)) throw new IdentityError('IDENTITY_CONFLICT');
    await this.dependencies.transactions.transaction((repository) =>
      repository.revokeSession(sessionId, this.dependencies.clock.now(), reason),
    );
  }

  public async revokeAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    await this.dependencies.transactions.transaction((repository) =>
      repository.revokeActiveSessions(
        userId,
        this.dependencies.clock.now(),
        'REVOKE_ALL',
        excludeSessionId,
      ),
    );
  }

  public async touchSession(sessionId: string, previousSeenAt: Date | null): Promise<boolean> {
    const now = this.dependencies.clock.now();
    if (
      previousSeenAt !== null &&
      addSeconds(previousSeenAt, this.dependencies.config.session.touchIntervalSeconds) > now
    ) {
      return false;
    }
    await this.dependencies.transactions.transaction((repository) =>
      repository.touchSession(sessionId, now),
    );
    return true;
  }
}
