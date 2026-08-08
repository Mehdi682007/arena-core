import { SecretValue } from '@arena-core/config';
import { describe, expect, it, vi } from 'vitest';
import {
  IdentityError,
  NodeCryptoTokenService,
  PhoneOtpService,
  type PhoneIdentityRepository,
  type PhoneIdentityTransactionManager,
} from '../src';

const user = {
  id: 'user-1',
  status: 'ACTIVE' as const,
  securityVersion: 3,
  deletedAt: null,
};

const phone = {
  id: 'phone-1',
  userId: 'user-1',
  phoneE164: '+989121234567',
  isPrimary: true,
  verifiedAt: new Date('2026-08-01'),
  createdAt: new Date('2026-08-01'),
  user,
};

function repository(): PhoneIdentityRepository {
  return {
    findUser: vi.fn(async () => user),
    findPhoneByE164: vi.fn(async () => phone),
    findVerifiedPhoneByE164: vi.fn(async () => phone),
    listUserPhones: vi.fn(async () => [phone]),
    createOtpChallenge: vi.fn(async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: new Date('2026-08-08T00:00:00Z'),
    })),
    findOtpChallenge: vi.fn(async () => null),
    recordOtpFailure: vi.fn(async () => undefined),
    consumeOtpChallenge: vi.fn(async () => true),
    verifyPhoneAndConsumeChallenge: vi.fn(async () => phone),
  };
}

function service(repo: PhoneIdentityRepository) {
  const transactions: PhoneIdentityTransactionManager = {
    transaction: (operation) => operation(repo),
  };

  return new PhoneOtpService({
    tokenService: new NodeCryptoTokenService({
      password: {
        minLength: 12,
        maxLength: 128,
        algorithm: 'argon2id',
        memoryKiB: 19456,
        iterations: 2,
        parallelism: 1,
      },
      session: {
        tokenBytes: 32,
        ttlSeconds: 3600,
        idleTimeoutSeconds: 1800,
        touchIntervalSeconds: 300,
      },
      emailVerification: {
        tokenBytes: 32,
        ttlSeconds: 3600,
      },
      passwordReset: {
        tokenBytes: 32,
        ttlSeconds: 3600,
      },
      lockout: {
        maxFailedAttempts: 5,
        seconds: 900,
      },
      tokenHashKey: new SecretValue('phone-test-token-hash-key-32-bytes-minimum'),
      ipHashKey: new SecretValue('phone-test-ip-hash-key-32-bytes-minimum-value'),
    }),
    codeGenerator: {
      generate: () => '123456',
    },
    clock: {
      now: () => new Date('2026-08-08T00:00:00Z'),
    },
    transactions,
  });
}

describe('phone OTP service', () => {
  it('issues a six digit sign-in challenge without persisting plaintext OTP', async () => {
    const repo = repository();

    const result = await service(repo).requestSignIn({
      phone: '+98 912 123 4567',
    });

    expect(result.delivery).toEqual({
      to: '+989121234567',
      code: '123456',
    });

    expect(repo.createOtpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneE164: '+989121234567',
        purpose: 'SIGN_IN',
        maxAttempts: 5,
      }),
    );

    const input = vi.mocked(repo.createOtpChallenge).mock.calls[0]?.[0];

    expect(input?.codeHash).not.toBe('123456');
  });

  it('does not reveal whether an unknown phone exists', async () => {
    const repo = repository();

    vi.mocked(repo.findVerifiedPhoneByE164).mockResolvedValue(null);

    const result = await service(repo).requestSignIn({
      phone: '+989121234567',
    });

    expect(result.challengeId).toBe('11111111-1111-4111-8111-111111111111');

    expect(result).not.toHaveProperty('delivery');
  });

  it('rejects invalid E.164 input', async () => {
    await expect(
      service(repository()).requestSignIn({
        phone: '09121234567',
      }),
    ).rejects.toBeInstanceOf(IdentityError);
  });

  it('lists only the current users phone projection', async () => {
    const result = await service(repository()).listUserPhones('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.phoneE164).toBe('+989121234567');
  });
});
