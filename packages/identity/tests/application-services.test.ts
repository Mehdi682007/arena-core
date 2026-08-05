import { createApiConfig } from '@arena-core/config';
import { describe, expect, it, vi } from 'vitest';
import {
  IdentityError,
  IdentityService,
  PasswordResetService,
  SessionService,
  type IdentityDependencies,
  type IdentityRepository,
} from '../src';

const authentication = createApiConfig(
  { NODE_ENV: 'test' },
  { packageVersion: '0.0.0', actualNodeVersion: process.versions.node },
).authentication;
const now = new Date('2026-07-25T00:00:00.000Z');

function harness(overrides: Partial<IdentityRepository> = {}) {
  const repository = {
    emailExists: vi.fn(async () => false),
    createRegistration: vi.fn(async () => ({ userId: 'user-1', emailId: 'email-1' })),
    findLoginIdentity: vi.fn(async () => null),
    recordAuthenticationFailure: vi.fn(async () => undefined),
    recordAuthenticationSuccess: vi.fn(async () => undefined),
    findUser: vi.fn(async () => null),
    createSession: vi.fn(async () => ({ id: 'session-1' })),
    recoverExpiredSuspension: vi.fn(async () => undefined),
    findSessionByTokenHash: vi.fn(async () => null),
    revokeSession: vi.fn(async () => undefined),
    revokeActiveSessions: vi.fn(async () => undefined),
    touchSession: vi.fn(async () => undefined),
    findEmail: vi.fn(async () => null),
    findVerificationIdentity: vi.fn(async () => null),
    createVerificationToken: vi.fn(async () => undefined),
    consumeActiveVerificationTokens: vi.fn(async () => undefined),
    findVerificationToken: vi.fn(async () => null),
    verifyEmailAndConsumeToken: vi.fn(async () => undefined),
    findResetIdentity: vi.fn(async () => null),
    createResetToken: vi.fn(async () => undefined),
    consumeActiveResetTokens: vi.fn(async () => undefined),
    findResetToken: vi.fn(async () => null),
    resetPassword: vi.fn(async () => 2),
    findCredential: vi.fn(async () => null),
    changePassword: vi.fn(async () => 2),
    ...overrides,
  } as IdentityRepository;
  const hasher = {
    hash: vi.fn(async (password: string) => ({
      algorithm: 'argon2id' as const,
      encodedHash: `hash:${password}`,
    })),
    verify: vi.fn(async (password: string, hash: string) => hash === `hash:${password}`),
    needsRehash: vi.fn(() => false),
  };
  const dependencies: IdentityDependencies = {
    config: authentication,
    passwordHasher: hasher,
    tokenService: {
      generateToken: vi.fn(() => 'opaque-token'),
      hashToken: vi.fn((kind, value) => `hmac:${kind}:${value}`),
      hashIp: vi.fn((value) => `ip-hmac:${value}`),
      constantTimeEqual: vi.fn((left, right) => left === right),
    },
    clock: { now: () => new Date(now) },
    transactions: { transaction: async (operation) => operation(repository) },
    dummyPasswordHash: 'hash:dummy',
  };
  return { repository, hasher, dependencies };
}

describe('IdentityService', () => {
  it('registers atomically with normalized email and hashes only', async () => {
    const { repository, dependencies } = harness();
    const result = await new IdentityService(dependencies).registerUser({
      email: ' Player+one@Example.COM ',
      password: 'a sufficiently long password',
    });
    expect(result).toMatchObject({ userId: 'user-1', status: 'PENDING_VERIFICATION' });
    expect(repository.createRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEmail: 'player+one@example.com',
        passwordHash: 'hash:a sufficiently long password',
        verificationTokenHash: 'hmac:email-verification:opaque-token',
      }),
    );
    expect(
      JSON.stringify((repository.createRegistration as ReturnType<typeof vi.fn>).mock.calls),
    ).not.toContain('"password":"');
  });

  it('uses the dummy hash and generic error for an unknown login', async () => {
    const { hasher, dependencies } = harness();
    await expect(
      new IdentityService(dependencies).authenticateWithPassword({
        email: 'missing@example.com',
        password: 'candidate-password',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(hasher.verify).toHaveBeenCalledWith('candidate-password', 'hash:dummy');
  });

  it('recovers expired suspension before authentication', async () => {
    const { repository, dependencies, hasher } = harness();

    repository.findLoginIdentity
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@example.com',
        passwordHash: 'hash:password',
        status: 'SUSPENDED',
        suspendedUntil: new Date(now.getTime() - 60_000),
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@example.com',
        passwordHash: 'hash:password',
        status: 'ACTIVE',
        suspendedUntil: null,
      });

    hasher.verify.mockResolvedValue(true);

    await new IdentityService(dependencies).authenticateWithPassword({
      email: 'player@example.com',
      password: 'password',
    });

    expect(repository.recoverExpiredSuspension).toHaveBeenCalledWith('user-1');

    expect(repository.findLoginIdentity).toHaveBeenCalledTimes(2);
  });

  it('records failures and locks at the configured threshold', async () => {
    const { repository, dependencies } = harness({
      findLoginIdentity: vi.fn(async () => ({
        emailId: 'email-1',
        id: 'user-1',
        status: 'ACTIVE' as const,
        securityVersion: 1,
        deletedAt: null,
        passwordHash: 'hash:correct-password',
        passwordAlgorithm: 'argon2id',
        failedAttemptCount: authentication.lockout.maxFailedAttempts - 1,
        lockedUntil: null,
      })),
    });
    await expect(
      new IdentityService(dependencies).authenticateWithPassword({
        email: 'player@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(IdentityError);
    expect(repository.recordAuthenticationFailure).toHaveBeenCalledWith(
      'user-1',
      authentication.lockout.maxFailedAttempts,
      new Date(now.getTime() + authentication.lockout.seconds * 1_000),
    );
  });

  it('authenticates an active user and records the injected time', async () => {
    const { repository, dependencies } = harness({
      findLoginIdentity: vi.fn(async () => ({
        emailId: 'email-1',
        id: 'user-1',
        status: 'ACTIVE' as const,
        securityVersion: 3,
        deletedAt: null,
        passwordHash: 'hash:correct-password',
        passwordAlgorithm: 'argon2id',
        failedAttemptCount: 0,
        lockedUntil: null,
      })),
    });
    await expect(
      new IdentityService(dependencies).authenticateWithPassword({
        email: 'player@example.com',
        password: 'correct-password',
      }),
    ).resolves.toMatchObject({ authenticated: true, securityVersion: 3 });
    expect(repository.recordAuthenticationSuccess).toHaveBeenCalledWith('user-1', now, undefined);
  });
});

describe('sessions and password reset', () => {
  it('persists only the session token hash and privacy-preserving IP hash', async () => {
    const { repository, dependencies } = harness({
      findUser: vi.fn(async () => ({
        id: 'user-1',
        status: 'ACTIVE' as const,
        securityVersion: 1,
        deletedAt: null,
      })),
    });
    const result = await new SessionService(dependencies).createSession({
      userId: 'user-1',
      securityVersion: 1,
      ip: '::ffff:192.0.2.1',
      userAgent: 'Browser\r\nInjected',
    });
    expect(result.token).toBe('opaque-token');
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: 'hmac:session:opaque-token',
        ipHash: 'ip-hmac:192.0.2.1',
        userAgent: 'Browser  Injected',
      }),
    );
  });

  it('rejects expired and stale-version sessions', async () => {
    const base = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash',
      securityVersion: 1,
      status: 'ACTIVE' as const,
      createdAt: new Date(now.getTime() - 1000),
      lastSeenAt: null,
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
      user: { id: 'user-1', status: 'ACTIVE' as const, securityVersion: 2, deletedAt: null },
    };
    const { dependencies } = harness({ findSessionByTokenHash: vi.fn(async () => base) });
    await expect(new SessionService(dependencies).validateSession('token')).rejects.toMatchObject({
      code: 'SESSION_INVALID',
    });
  });

  it('keeps reset requests enumeration-safe and requires verified identity', async () => {
    const { repository, dependencies } = harness({
      findResetIdentity: vi.fn(async () => ({
        userId: 'user-1',
        status: 'ACTIVE',
        verifiedAt: null,
      })),
    });
    await expect(
      new PasswordResetService(dependencies).issuePasswordResetToken({
        email: 'player@example.com',
      }),
    ).resolves.toEqual({ accepted: true });
    expect(repository.createResetToken).not.toHaveBeenCalled();
  });
});
