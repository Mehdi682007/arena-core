import { describe, expect, it, vi } from 'vitest';
import {
  MfaService,
  type MfaCrypto,
  type MfaRepository,
  type MfaTransactionManager,
  type TokenService,
} from '../src';

const now = new Date('2026-08-08T02:00:00Z');

const user = {
  id: 'user-1',
  status: 'ACTIVE',
  securityVersion: 4,
  deletedAt: null,
  accountName: 'player@example.com',
};

const factor = {
  id: 'totp-1',
  userId: 'user-1',
  secretCiphertext: 'sealed',
  secretIv: 'iv',
  secretTag: 'tag',
  enabledAt: new Date('2026-08-08T01:00:00Z'),
  createdAt: new Date('2026-08-08T01:00:00Z'),
  updatedAt: new Date('2026-08-08T01:00:00Z'),
};

const challenge = {
  id: 'challenge-1',
  userId: 'user-1',
  tokenHash: 'mfa-challenge:challenge-token',
  securityVersion: 4,
  createdAt: now,
  expiresAt: new Date('2026-08-08T02:05:00Z'),
  consumedAt: null,
  attemptCount: 0,
  maxAttempts: 5,
};

function repository(): MfaRepository {
  return {
    secureSessionsAfterMfaEnable: async () => undefined,
    findUser: vi.fn(async () => user),

    findTotp: vi.fn(async () => factor),

    countAvailableRecoveryCodes: vi.fn(async () => 10),

    upsertPendingTotp: vi.fn(async () => undefined),

    enableTotp: vi.fn(async () => undefined),
    hasRecentMfaAssurance: vi.fn(async () => true),
    upsertPendingTotpRotation: vi.fn(async () => undefined),
    findPendingTotpRotation: vi.fn(async () => null),
    consumePendingTotpRotation: vi.fn(async () => true),
    cancelPendingTotpRotation: vi.fn(async () => undefined),
    replaceTotpAndRecoveryCodes: vi.fn(async () => undefined),
    secureSessionsAfterMfaRotation: vi.fn(async () => undefined),

    createLoginChallenge: vi.fn(async () => ({
      id: challenge.id,
    })),

    findLoginChallengeByTokenHash: vi.fn(async () => challenge),

    recordLoginChallengeFailure: vi.fn(async () => undefined),

    consumeLoginChallenge: vi.fn(async () => true),

    consumeRecoveryCode: vi.fn(async () => false),
  };
}

const crypto: MfaCrypto = {
  generateTotpSecret: () => 'SECRET',

  sealTotpSecret: () => ({
    ciphertext: 'sealed',
    iv: 'iv',
    tag: 'tag',
  }),

  openTotpSecret: () => 'SECRET',

  buildTotpUri: () => 'otpauth://totp/test',

  totp: () => '123456',

  verifyTotp: (_secret, code) => code === '123456',

  generateRecoveryCodes: () => ['AAAA-BBBB-CCCC'],

  hashRecoveryCode: (code) => `recovery:${code}`,
};

const tokenService: TokenService = {
  generateToken: () => 'challenge-token',

  hashToken: (type, token) => `${type}:${token}`,

  hashIp: (ip) => `ip:${ip}`,

  constantTimeEqual: (left, right) => left === right,
};

function service(repo: MfaRepository) {
  const transactions: MfaTransactionManager = {
    transaction: (operation) => operation(repo),
  };

  return new MfaService({
    crypto,
    tokenService,
    clock: {
      now: () => now,
    },
    transactions,
  });
}

describe('MFA login challenge', () => {
  it('does not issue a challenge when MFA is disabled', async () => {
    const repo = repository();

    vi.mocked(repo.findTotp).mockResolvedValue(null);

    const result = await service(repo).beginLoginChallenge({
      userId: user.id,
      securityVersion: user.securityVersion,
    });

    expect(result).toEqual({
      required: false,
    });

    expect(repo.createLoginChallenge).not.toHaveBeenCalled();
  });

  it('stores only the hashed challenge token', async () => {
    const repo = repository();

    const result = await service(repo).beginLoginChallenge({
      userId: user.id,
      securityVersion: user.securityVersion,
    });

    expect(result).toEqual({
      required: true,
      challengeToken: 'challenge-token',
      expiresAt: new Date('2026-08-08T02:05:00Z'),
    });

    expect(repo.createLoginChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: 'mfa-challenge:challenge-token',
        securityVersion: 4,
        maxAttempts: 5,
      }),
    );

    const write = vi.mocked(repo.createLoginChallenge).mock.calls[0]?.[0];

    expect(write?.tokenHash).not.toBe('challenge-token');
  });

  it('confirms TOTP and consumes the challenge', async () => {
    const repo = repository();

    const result = await service(repo).confirmLoginChallenge({
      challengeToken: 'challenge-token',
      code: '123456',
    });

    expect(result).toEqual({
      userId: 'user-1',
      securityVersion: 4,
      mfaVerifiedAt: now,
    });

    expect(repo.consumeRecoveryCode).not.toHaveBeenCalled();

    expect(repo.consumeLoginChallenge).toHaveBeenCalledWith('challenge-1', now);
  });

  it('consumes a valid recovery code once', async () => {
    const repo = repository();

    vi.mocked(repo.consumeRecoveryCode).mockResolvedValue(true);

    const result = await service(repo).confirmLoginChallenge({
      challengeToken: 'challenge-token',
      code: 'AAAA-BBBB-CCCC',
    });

    expect(result.userId).toBe('user-1');

    expect(repo.consumeRecoveryCode).toHaveBeenCalledWith('user-1', 'recovery:AAAA-BBBB-CCCC', now);

    expect(repo.consumeLoginChallenge).toHaveBeenCalledTimes(1);
  });

  it('records failed attempts for invalid codes', async () => {
    const repo = repository();

    await expect(
      service(repo).confirmLoginChallenge({
        challengeToken: 'challenge-token',
        code: '000000',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_MFA_CODE',
    });

    expect(repo.recordLoginChallengeFailure).toHaveBeenCalledWith('challenge-1');

    expect(repo.consumeLoginChallenge).not.toHaveBeenCalled();
  });
});
