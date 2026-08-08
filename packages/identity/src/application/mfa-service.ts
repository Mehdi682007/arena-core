import { IdentityError } from '../domain/identity-errors';
import type { MfaStatusView } from '../domain/mfa-types';
import type { Clock, TokenService } from '../ports/crypto';
import type { MfaCrypto } from '../ports/mfa-crypto';
import type { MfaTransactionManager } from '../ports/mfa-repository';

const loginChallengeTtlSeconds = 300;
const loginChallengeMaxAttempts = 5;
const totpRotationTtlSeconds = 600;
const recentMfaAssuranceSeconds = 600;

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function ensureActive(status: string, deletedAt: Date | null): void {
  if (status !== 'ACTIVE' || deletedAt !== null) {
    throw new IdentityError('ACCOUNT_NOT_ACTIVE');
  }
}

export type MfaLoginChallengeIssue =
  | Readonly<{
      required: false;
    }>
  | Readonly<{
      required: true;
      challengeToken: string;
      expiresAt: Date;
    }>;

export class MfaService {
  public constructor(
    private readonly dependencies: Readonly<{
      crypto: MfaCrypto;
      tokenService: TokenService;
      clock: Clock;
      transactions: MfaTransactionManager;
    }>,
  ) {}

  public async status(userId: string): Promise<MfaStatusView> {
    return this.dependencies.transactions.transaction(async (repository) => {
      const factor = await repository.findTotp(userId);

      if (factor === null || factor.enabledAt === null) {
        return Object.freeze({
          enabled: false,
          enabledAt: null,
          recoveryCodesRemaining: 0,
        });
      }

      const count = await repository.countAvailableRecoveryCodes(userId);

      return Object.freeze({
        enabled: true,
        enabledAt: factor.enabledAt,
        recoveryCodesRemaining: count,
      });
    });
  }

  public async startTotpEnrollment(userId: string): Promise<{
    secret: string;
    otpauthUri: string;
  }> {
    const secret = this.dependencies.crypto.generateTotpSecret();

    const sealed = this.dependencies.crypto.sealTotpSecret(secret);

    const accountName = await this.dependencies.transactions.transaction(async (repository) => {
      const user = await repository.findUser(userId);

      if (user === null) {
        throw new IdentityError('ACCOUNT_NOT_ACTIVE');
      }

      ensureActive(user.status, user.deletedAt);

      const existing = await repository.findTotp(userId);

      if (existing !== null && existing.enabledAt !== null) {
        throw new IdentityError('MFA_ALREADY_ENABLED');
      }

      await repository.upsertPendingTotp({
        userId,
        sealed,
        at: this.dependencies.clock.now(),
      });

      return user.accountName;
    });

    return Object.freeze({
      secret,
      otpauthUri: this.dependencies.crypto.buildTotpUri(accountName, secret),
    });
  }

  public async confirmTotpEnrollment(
    userId: string,
    currentSessionId: string,
    code: string,
  ): Promise<{
    recoveryCodes: readonly string[];
  }> {
    if (!/^[0-9]{6}$/.test(code)) {
      throw new IdentityError('INVALID_MFA_CODE');
    }

    return this.dependencies.transactions.transaction(async (repository) => {
      const factor = await repository.findTotp(userId);

      if (factor === null || factor.enabledAt !== null) {
        throw new IdentityError(factor?.enabledAt ? 'MFA_ALREADY_ENABLED' : 'MFA_NOT_ENROLLED');
      }

      const secret = this.dependencies.crypto.openTotpSecret({
        ciphertext: factor.secretCiphertext,
        iv: factor.secretIv,
        tag: factor.secretTag,
      });

      const now = this.dependencies.clock.now();

      if (!this.dependencies.crypto.verifyTotp(secret, code, now)) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      const recoveryCodes = this.dependencies.crypto.generateRecoveryCodes(10);

      const hashes = recoveryCodes.map((item) => this.dependencies.crypto.hashRecoveryCode(item));

      await repository.enableTotp({
        userId,
        at: now,
        recoveryCodeHashes: hashes,
      });

      await repository.secureSessionsAfterMfaEnable({
        userId,
        currentSessionId,
        at: now,
      });

      return Object.freeze({
        recoveryCodes,
      });
    });
  }

  public async startTotpRotation(
    userId: string,
    currentSessionId: string,
  ): Promise<{
    secret: string;
    otpauthUri: string;
    expiresAt: Date;
  }> {
    const secret = this.dependencies.crypto.generateTotpSecret();
    const sealed = this.dependencies.crypto.sealTotpSecret(secret);
    const now = this.dependencies.clock.now();
    const expiresAt = addSeconds(now, totpRotationTtlSeconds);

    const accountName = await this.dependencies.transactions.transaction(async (repository) => {
      const user = await repository.findUser(userId);

      if (user === null) {
        throw new IdentityError('ACCOUNT_NOT_ACTIVE');
      }

      ensureActive(user.status, user.deletedAt);

      const factor = await repository.findTotp(userId);

      if (factor === null || factor.enabledAt === null) {
        throw new IdentityError('MFA_NOT_ENROLLED');
      }

      const assured = await repository.hasRecentMfaAssurance({
        userId,
        sessionId: currentSessionId,
        verifiedAfter: addSeconds(now, -recentMfaAssuranceSeconds),
        at: now,
      });

      if (!assured) {
        throw new IdentityError('MFA_RECENT_VERIFICATION_REQUIRED');
      }

      await repository.upsertPendingTotpRotation({
        userId,
        totpId: factor.id,
        sealed,
        at: now,
        expiresAt,
      });

      return user.accountName;
    });

    return Object.freeze({
      secret,
      otpauthUri: this.dependencies.crypto.buildTotpUri(accountName, secret),
      expiresAt,
    });
  }

  public async confirmTotpRotation(
    userId: string,
    currentSessionId: string,
    code: string,
  ): Promise<{ recoveryCodes: readonly string[] }> {
    if (!/^[0-9]{6}$/.test(code)) {
      throw new IdentityError('INVALID_MFA_CODE');
    }

    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const factor = await repository.findTotp(userId);

      if (factor === null || factor.enabledAt === null) {
        throw new IdentityError('MFA_NOT_ENROLLED');
      }

      const assured = await repository.hasRecentMfaAssurance({
        userId,
        sessionId: currentSessionId,
        verifiedAfter: addSeconds(now, -recentMfaAssuranceSeconds),
        at: now,
      });

      if (!assured) {
        throw new IdentityError('MFA_RECENT_VERIFICATION_REQUIRED');
      }

      const pending = await repository.findPendingTotpRotation(userId);

      if (pending === null || pending.totpId !== factor.id) {
        throw new IdentityError('MFA_ROTATION_NOT_PENDING');
      }

      if (pending.expiresAt <= now) {
        throw new IdentityError('MFA_ROTATION_EXPIRED');
      }

      const secret = this.dependencies.crypto.openTotpSecret({
        ciphertext: pending.candidateSecretCiphertext,
        iv: pending.candidateSecretIv,
        tag: pending.candidateSecretTag,
      });

      if (!this.dependencies.crypto.verifyTotp(secret, code, now)) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      const recoveryCodes = this.dependencies.crypto.generateRecoveryCodes(10);
      const recoveryCodeHashes = recoveryCodes.map((item) =>
        this.dependencies.crypto.hashRecoveryCode(item),
      );

      const consumed = await repository.consumePendingTotpRotation(pending.id, now);

      if (!consumed) {
        throw new IdentityError('MFA_ROTATION_NOT_PENDING');
      }

      await repository.replaceTotpAndRecoveryCodes({
        userId,
        sealed: {
          ciphertext: pending.candidateSecretCiphertext,
          iv: pending.candidateSecretIv,
          tag: pending.candidateSecretTag,
        },
        at: now,
        recoveryCodeHashes,
      });

      await repository.secureSessionsAfterMfaRotation({
        userId,
        currentSessionId,
        at: now,
      });

      return Object.freeze({ recoveryCodes });
    });
  }

  public async cancelTotpRotation(userId: string, currentSessionId: string): Promise<void> {
    const now = this.dependencies.clock.now();

    await this.dependencies.transactions.transaction(async (repository) => {
      const factor = await repository.findTotp(userId);

      if (factor === null || factor.enabledAt === null) {
        throw new IdentityError('MFA_NOT_ENROLLED');
      }

      const assured = await repository.hasRecentMfaAssurance({
        userId,
        sessionId: currentSessionId,
        verifiedAfter: addSeconds(now, -recentMfaAssuranceSeconds),
        at: now,
      });

      if (!assured) {
        throw new IdentityError('MFA_RECENT_VERIFICATION_REQUIRED');
      }

      await repository.cancelPendingTotpRotation(userId);
    });
  }

  public async beginLoginChallenge(input: {
    userId: string;
    securityVersion: number;
  }): Promise<MfaLoginChallengeIssue> {
    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const user = await repository.findUser(input.userId);

      if (user === null) {
        throw new IdentityError('ACCOUNT_NOT_ACTIVE');
      }

      ensureActive(user.status, user.deletedAt);

      if (user.securityVersion !== input.securityVersion) {
        throw new IdentityError('SESSION_INVALID');
      }

      const factor = await repository.findTotp(user.id);

      if (factor === null || factor.enabledAt === null) {
        return Object.freeze({
          required: false as const,
        });
      }

      const challengeToken = this.dependencies.tokenService.generateToken(32);

      const tokenHash = this.dependencies.tokenService.hashToken('mfa-challenge', challengeToken);

      const expiresAt = addSeconds(now, loginChallengeTtlSeconds);

      await repository.createLoginChallenge({
        userId: user.id,
        tokenHash,
        securityVersion: user.securityVersion,
        expiresAt,
        maxAttempts: loginChallengeMaxAttempts,
      });

      return Object.freeze({
        required: true as const,
        challengeToken,
        expiresAt,
      });
    });
  }

  public async confirmLoginChallenge(input: { challengeToken: string; code: string }): Promise<{
    userId: string;
    securityVersion: number;
    mfaVerifiedAt: Date;
  }> {
    const tokenHash = this.dependencies.tokenService.hashToken(
      'mfa-challenge',
      input.challengeToken,
    );

    const now = this.dependencies.clock.now();

    return this.dependencies.transactions.transaction(async (repository) => {
      const challenge = await repository.findLoginChallengeByTokenHash(tokenHash);

      if (
        challenge === null ||
        challenge.consumedAt !== null ||
        challenge.expiresAt <= now ||
        challenge.attemptCount >= challenge.maxAttempts
      ) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      const user = await repository.findUser(challenge.userId);

      if (user === null) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      ensureActive(user.status, user.deletedAt);

      if (user.securityVersion !== challenge.securityVersion) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      const factor = await repository.findTotp(user.id);

      if (factor === null || factor.enabledAt === null) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      const secret = this.dependencies.crypto.openTotpSecret({
        ciphertext: factor.secretCiphertext,
        iv: factor.secretIv,
        tag: factor.secretTag,
      });

      const totpValid =
        /^[0-9]{6}$/.test(input.code) &&
        this.dependencies.crypto.verifyTotp(secret, input.code, now);

      let recoveryValid = false;

      if (!totpValid) {
        const recoveryHash = this.dependencies.crypto.hashRecoveryCode(input.code);

        recoveryValid = await repository.consumeRecoveryCode(user.id, recoveryHash, now);
      }

      if (!totpValid && !recoveryValid) {
        await repository.recordLoginChallengeFailure(challenge.id);

        throw new IdentityError('INVALID_MFA_CODE');
      }

      const consumed = await repository.consumeLoginChallenge(challenge.id, now);

      if (!consumed) {
        throw new IdentityError('INVALID_MFA_CODE');
      }

      return Object.freeze({
        userId: user.id,
        securityVersion: user.securityVersion,
        mfaVerifiedAt: now,
      });
    });
  }
}
