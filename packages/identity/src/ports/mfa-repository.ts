import type {
  MfaLoginChallengeRecord,
  MfaTotpRecord,
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
