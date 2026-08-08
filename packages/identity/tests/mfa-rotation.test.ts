import { describe, expect, it, vi } from 'vitest';
import { MfaService, type MfaCrypto, type MfaRepository, type MfaTotpRotationRecord } from '../src';

const now = new Date('2026-08-08T12:00:00Z');
const oldFactor = {
  id: 'totp-1',
  userId: 'user-1',
  secretCiphertext: 'old-sealed',
  secretIv: 'old-iv',
  secretTag: 'old-tag',
  enabledAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function fixture(options: { assured?: boolean; expired?: boolean } = {}) {
  let pending: MfaTotpRotationRecord | null = null;
  let factor = { ...oldFactor };
  let recovery = ['old-1', 'old-2'];
  const repo: MfaRepository = {
    findUser: vi.fn(async () => ({
      id: 'user-1',
      status: 'ACTIVE',
      securityVersion: 1,
      deletedAt: null,
      accountName: 'player@example.com',
    })),
    findTotp: vi.fn(async () => factor),
    countAvailableRecoveryCodes: vi.fn(async () => recovery.length),
    upsertPendingTotp: vi.fn(async () => undefined),
    enableTotp: vi.fn(async () => undefined),
    hasRecentMfaAssurance: vi.fn(async () => options.assured !== false),
    upsertPendingTotpRotation: vi.fn(
      async (input: Parameters<MfaRepository['upsertPendingTotpRotation']>[0]) => {
        pending = {
          id: 'rotation-1',
          ...input,
          candidateSecretCiphertext: input.sealed.ciphertext,
          candidateSecretIv: input.sealed.iv,
          candidateSecretTag: input.sealed.tag,
          expiresAt: options.expired ? new Date(now.getTime() - 1) : input.expiresAt,
          createdAt: input.at,
          updatedAt: input.at,
        };
      },
    ),
    findPendingTotpRotation: vi.fn(async () => pending),
    consumePendingTotpRotation: vi.fn(async () => {
      pending = null;
      return true;
    }),
    cancelPendingTotpRotation: vi.fn(async () => {
      pending = null;
    }),
    replaceTotpAndRecoveryCodes: vi.fn(
      async (input: Parameters<MfaRepository['replaceTotpAndRecoveryCodes']>[0]) => {
        factor = {
          ...factor,
          secretCiphertext: input.sealed.ciphertext,
          secretIv: input.sealed.iv,
          secretTag: input.sealed.tag,
        };
        recovery = [...input.recoveryCodeHashes];
      },
    ),
    secureSessionsAfterMfaRotation: vi.fn(async () => undefined),
    secureSessionsAfterMfaEnable: vi.fn(async () => undefined),
    createLoginChallenge: vi.fn(async () => ({ id: 'challenge' })),
    findLoginChallengeByTokenHash: vi.fn(async () => null),
    recordLoginChallengeFailure: vi.fn(async () => undefined),
    consumeLoginChallenge: vi.fn(async () => true),
    consumeRecoveryCode: vi.fn(async () => false),
  };
  const crypto: MfaCrypto = {
    generateTotpSecret: () => 'NEW-SECRET',
    sealTotpSecret: () => ({ ciphertext: 'new-sealed', iv: 'new-iv', tag: 'new-tag' }),
    openTotpSecret: (sealed) => (sealed.ciphertext === 'new-sealed' ? 'NEW-SECRET' : 'OLD-SECRET'),
    buildTotpUri: (account, secret) => `otpauth://totp/Arena:${account}?secret=${secret}`,
    totp: () => '123456',
    verifyTotp: (secret, code) => secret === 'NEW-SECRET' && code === '123456',
    generateRecoveryCodes: (count) => Array.from({ length: count }, (_, index) => `new-${index}`),
    hashRecoveryCode: (code) => `hash:${code}`,
  };
  const service = new MfaService({
    crypto,
    tokenService: {
      generateToken: () => 'token',
      hashToken: () => 'hash',
      hashIp: () => 'ip',
      constantTimeEqual: (a, b) => a === b,
    },
    clock: { now: () => now },
    transactions: { transaction: (operation) => operation(repo) },
  });
  return { service, repo, crypto, state: () => ({ pending, factor, recovery }) };
}

describe('TOTP rotation', () => {
  it('keeps the active factor and recovery codes unchanged while rotation is pending or cancelled', async () => {
    const { service, state } = fixture();
    await service.startTotpRotation('user-1', 'session-1');
    expect(state().factor.secretCiphertext).toBe('old-sealed');
    expect(state().recovery).toEqual(['old-1', 'old-2']);
    await service.cancelTotpRotation('user-1', 'session-1');
    expect(state()).toMatchObject({ pending: null, recovery: ['old-1', 'old-2'] });
  });

  it('atomically replaces the factor and issues exactly ten new recovery hashes after valid confirmation', async () => {
    const { service, repo, crypto, state } = fixture();
    await service.startTotpRotation('user-1', 'session-1');
    const result = await service.confirmTotpRotation('user-1', 'session-1', '123456');
    expect(result.recoveryCodes).toHaveLength(10);
    expect(state().factor.secretCiphertext).toBe('new-sealed');
    expect(crypto.verifyTotp('NEW-SECRET', '123456', now)).toBe(true);
    expect(crypto.verifyTotp('OLD-SECRET', '123456', now)).toBe(false);
    expect(state().recovery).toHaveLength(10);
    expect(state().pending).toBeNull();
    expect(repo.secureSessionsAfterMfaRotation).toHaveBeenCalledWith(
      expect.objectContaining({ currentSessionId: 'session-1' }),
    );
  });

  it.each([
    ['invalid code', {}, '000000', 'INVALID_MFA_CODE'],
    ['expired candidate', { expired: true }, '123456', 'MFA_ROTATION_EXPIRED'],
    ['stale assurance', { assured: false }, '123456', 'MFA_RECENT_VERIFICATION_REQUIRED'],
  ])(
    'rejects %s without changing the active credential',
    async (_name, options, code, expected) => {
      const { service, state } = fixture(options);
      if (expected !== 'MFA_RECENT_VERIFICATION_REQUIRED')
        await service.startTotpRotation('user-1', 'session-1');
      await expect(
        expected === 'MFA_RECENT_VERIFICATION_REQUIRED'
          ? service.startTotpRotation('user-1', 'session-1')
          : service.confirmTotpRotation('user-1', 'session-1', code),
      ).rejects.toMatchObject({ code: expected });
      expect(state().factor.secretCiphertext).toBe('old-sealed');
      expect(state().recovery).toEqual(['old-1', 'old-2']);
    },
  );
});
