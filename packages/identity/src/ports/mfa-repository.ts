import type {
  MfaLoginChallengeRecord,
  MfaTotpRecord,
  MfaTotpRotationRecord,
  MfaUserRecord,
  SealedMfaSecret,
} from '../domain/mfa-types';

export interface MfaRepository {
  findUser(userId: string): Promise<MfaUserRecord | null>;

  findTotp(userId: string): Promise<MfaTotpRecord | null>;

  countAvailableRecoveryCodes(userId: string): Promise<number>;

  upsertPendingTotp(input: { userId: string; sealed: SealedMfaSecret; at: Date }): Promise<void>;

  enableTotp(input: {
    userId: string;
    at: Date;
    recoveryCodeHashes: readonly string[];
  }): Promise<void>;

  hasRecentMfaAssurance(input: {
    userId: string;
    sessionId: string;
    verifiedAfter: Date;
    at: Date;
  }): Promise<boolean>;

  upsertPendingTotpRotation(input: {
    userId: string;
    totpId: string;
    sealed: SealedMfaSecret;
    at: Date;
    expiresAt: Date;
  }): Promise<void>;

  findPendingTotpRotation(userId: string): Promise<MfaTotpRotationRecord | null>;

  consumePendingTotpRotation(rotationId: string, at: Date): Promise<boolean>;

  cancelPendingTotpRotation(userId: string): Promise<void>;

  replaceTotpAndRecoveryCodes(input: {
    userId: string;
    sealed: SealedMfaSecret;
    at: Date;
    recoveryCodeHashes: readonly string[];
  }): Promise<void>;

  secureSessionsAfterMfaRotation(input: {
    userId: string;
    currentSessionId: string;
    at: Date;
  }): Promise<void>;

  createLoginChallenge(input: {
    userId: string;
    tokenHash: string;
    securityVersion: number;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<{ id: string }>;

  findLoginChallengeByTokenHash(tokenHash: string): Promise<MfaLoginChallengeRecord | null>;

  recordLoginChallengeFailure(challengeId: string): Promise<void>;

  consumeLoginChallenge(challengeId: string, at: Date): Promise<boolean>;

  consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean>;

  secureSessionsAfterMfaEnable(input: {
    userId: string;
    currentSessionId: string;
    at: Date;
  }): Promise<void>;
}

export interface MfaTransactionManager {
  transaction<T>(operation: (repository: MfaRepository) => Promise<T>): Promise<T>;
}
