export interface SealedMfaSecret {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
}

export interface MfaUserRecord {
  readonly id: string;
  readonly status: string;
  readonly securityVersion: number;
  readonly deletedAt: Date | null;
  readonly accountName: string;
}

export interface MfaTotpRecord {
  readonly id: string;
  readonly userId: string;
  readonly secretCiphertext: string;
  readonly secretIv: string;
  readonly secretTag: string;
  readonly enabledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MfaTotpRotationRecord {
  readonly id: string;
  readonly userId: string;
  readonly totpId: string;
  readonly candidateSecretCiphertext: string;
  readonly candidateSecretIv: string;
  readonly candidateSecretTag: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
}

export interface MfaLoginChallengeRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly securityVersion: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
}

export interface MfaStatusView {
  readonly enabled: boolean;
  readonly enabledAt: Date | null;
  readonly recoveryCodesRemaining: number;
}
