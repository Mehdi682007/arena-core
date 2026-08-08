import { Prisma, type ArenaPrismaClient } from '@arena-core/database';
import { IdentityError } from '../domain/identity-errors';
import type {
  MfaLoginChallengeRecord,
  MfaTotpRecord,
  MfaTotpRotationRecord,
  MfaUserRecord,
} from '../domain/mfa-types';
import type { MfaRepository, MfaTransactionManager } from '../ports/mfa-repository';

type MfaPrismaClient = ArenaPrismaClient | Prisma.TransactionClient;

function persistenceError(error: unknown): IdentityError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new IdentityError('IDENTITY_CONFLICT', { cause: error });
  }

  return new IdentityError('IDENTITY_PERSISTENCE_FAILURE', { cause: error });
}

export class PrismaMfaRepository implements MfaRepository {
  public constructor(private readonly client: MfaPrismaClient) {}

  public async findUser(userId: string): Promise<MfaUserRecord | null> {
    const row = await this.client.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        status: true,
        securityVersion: true,
        deletedAt: true,
        emails: {
          where: {
            isPrimary: true,
          },
          select: {
            email: true,
          },
          take: 1,
        },
      },
    });

    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      securityVersion: row.securityVersion,
      deletedAt: row.deletedAt,
      accountName: row.emails[0]?.email ?? row.id,
    };
  }

  public findTotp(userId: string): Promise<MfaTotpRecord | null> {
    return this.client.userMfaTotp.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
        secretCiphertext: true,
        secretIv: true,
        secretTag: true,
        enabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  public countAvailableRecoveryCodes(userId: string): Promise<number> {
    return this.client.mfaRecoveryCode.count({
      where: {
        totp: {
          userId,
          enabledAt: {
            not: null,
          },
        },
        consumedAt: null,
      },
    });
  }

  public async upsertPendingTotp(input: {
    userId: string;
    sealed: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
    at: Date;
  }): Promise<void> {
    const existing = await this.client.userMfaTotp.findUnique({
      where: {
        userId: input.userId,
      },
      select: {
        id: true,
        enabledAt: true,
      },
    });

    if (existing?.enabledAt) {
      throw new IdentityError('MFA_ALREADY_ENABLED');
    }

    if (existing === null) {
      await this.client.userMfaTotp.create({
        data: {
          userId: input.userId,
          secretCiphertext: input.sealed.ciphertext,
          secretIv: input.sealed.iv,
          secretTag: input.sealed.tag,
          createdAt: input.at,
          updatedAt: input.at,
        },
        select: {
          id: true,
        },
      });

      return;
    }

    await this.client.userMfaTotp.update({
      where: {
        id: existing.id,
      },
      data: {
        secretCiphertext: input.sealed.ciphertext,
        secretIv: input.sealed.iv,
        secretTag: input.sealed.tag,
        enabledAt: null,
        updatedAt: input.at,
      },
      select: {
        id: true,
      },
    });

    await this.client.mfaRecoveryCode.deleteMany({
      where: {
        totpId: existing.id,
      },
    });
  }

  public async enableTotp(input: {
    userId: string;
    at: Date;
    recoveryCodeHashes: readonly string[];
  }): Promise<void> {
    const factor = await this.client.userMfaTotp.findUnique({
      where: {
        userId: input.userId,
      },
      select: {
        id: true,
        enabledAt: true,
      },
    });

    if (factor === null || factor.enabledAt !== null) {
      throw new IdentityError(factor?.enabledAt ? 'MFA_ALREADY_ENABLED' : 'MFA_NOT_ENROLLED');
    }

    const updated = await this.client.userMfaTotp.updateMany({
      where: {
        id: factor.id,
        enabledAt: null,
      },
      data: {
        enabledAt: input.at,
        updatedAt: input.at,
      },
    });

    if (updated.count !== 1) {
      throw new IdentityError('MFA_NOT_ENROLLED');
    }

    await this.client.mfaRecoveryCode.deleteMany({
      where: {
        totpId: factor.id,
      },
    });

    await this.client.mfaRecoveryCode.createMany({
      data: input.recoveryCodeHashes.map((codeHash) => ({
        totpId: factor.id,
        codeHash,
        createdAt: input.at,
      })),
    });
  }

  public async hasRecentMfaAssurance(input: {
    userId: string;
    sessionId: string;
    verifiedAfter: Date;
    at: Date;
  }): Promise<boolean> {
    const count = await this.client.userSession.count({
      where: {
        id: input.sessionId,
        userId: input.userId,
        status: 'ACTIVE',
        expiresAt: {
          gt: input.at,
        },
        mfaVerifiedAt: {
          gte: input.verifiedAfter,
        },
      },
    });

    return count === 1;
  }

  public async upsertPendingTotpRotation(input: {
    userId: string;
    totpId: string;
    sealed: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
    at: Date;
    expiresAt: Date;
  }): Promise<void> {
    await this.client.mfaTotpRotation.upsert({
      where: {
        userId: input.userId,
      },
      create: {
        userId: input.userId,
        totpId: input.totpId,
        candidateSecretCiphertext: input.sealed.ciphertext,
        candidateSecretIv: input.sealed.iv,
        candidateSecretTag: input.sealed.tag,
        createdAt: input.at,
        updatedAt: input.at,
        expiresAt: input.expiresAt,
      },
      update: {
        totpId: input.totpId,
        candidateSecretCiphertext: input.sealed.ciphertext,
        candidateSecretIv: input.sealed.iv,
        candidateSecretTag: input.sealed.tag,
        updatedAt: input.at,
        expiresAt: input.expiresAt,
      },
      select: {
        id: true,
      },
    });
  }

  public findPendingTotpRotation(userId: string): Promise<MfaTotpRotationRecord | null> {
    return this.client.mfaTotpRotation.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
        totpId: true,
        candidateSecretCiphertext: true,
        candidateSecretIv: true,
        candidateSecretTag: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });
  }

  public async consumePendingTotpRotation(rotationId: string, at: Date): Promise<boolean> {
    const result = await this.client.mfaTotpRotation.deleteMany({
      where: {
        id: rotationId,
        expiresAt: {
          gt: at,
        },
      },
    });

    return result.count === 1;
  }

  public async cancelPendingTotpRotation(userId: string): Promise<void> {
    await this.client.mfaTotpRotation.deleteMany({
      where: {
        userId,
      },
    });
  }

  public async replaceTotpAndRecoveryCodes(input: {
    userId: string;
    sealed: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
    at: Date;
    recoveryCodeHashes: readonly string[];
  }): Promise<void> {
    const factor = await this.client.userMfaTotp.findUnique({
      where: {
        userId: input.userId,
      },
      select: {
        id: true,
        enabledAt: true,
      },
    });

    if (factor === null || factor.enabledAt === null) {
      throw new IdentityError('MFA_NOT_ENROLLED');
    }

    const updated = await this.client.userMfaTotp.updateMany({
      where: {
        id: factor.id,
        enabledAt: {
          not: null,
        },
      },
      data: {
        secretCiphertext: input.sealed.ciphertext,
        secretIv: input.sealed.iv,
        secretTag: input.sealed.tag,
        updatedAt: input.at,
      },
    });

    if (updated.count !== 1) {
      throw new IdentityError('MFA_NOT_ENROLLED');
    }

    await this.client.mfaRecoveryCode.deleteMany({
      where: {
        totpId: factor.id,
      },
    });

    await this.client.mfaRecoveryCode.createMany({
      data: input.recoveryCodeHashes.map((codeHash) => ({
        totpId: factor.id,
        codeHash,
        createdAt: input.at,
      })),
    });
  }

  public createLoginChallenge(input: {
    userId: string;
    tokenHash: string;
    securityVersion: number;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<{ id: string }> {
    return this.client.mfaLoginChallenge.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        securityVersion: input.securityVersion,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts,
      },
      select: {
        id: true,
      },
    });
  }

  public findLoginChallengeByTokenHash(tokenHash: string): Promise<MfaLoginChallengeRecord | null> {
    return this.client.mfaLoginChallenge.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        securityVersion: true,
        createdAt: true,
        expiresAt: true,
        consumedAt: true,
        attemptCount: true,
        maxAttempts: true,
      },
    });
  }

  public async recordLoginChallengeFailure(challengeId: string): Promise<void> {
    await this.client.mfaLoginChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
      },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });
  }

  public async consumeLoginChallenge(challengeId: string, at: Date): Promise<boolean> {
    const result = await this.client.mfaLoginChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
      },
      data: {
        consumedAt: at,
      },
    });

    return result.count === 1;
  }

  public async consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean> {
    const code = await this.client.mfaRecoveryCode.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        totp: {
          userId,
          enabledAt: {
            not: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (code === null) {
      return false;
    }

    const result = await this.client.mfaRecoveryCode.updateMany({
      where: {
        id: code.id,
        consumedAt: null,
      },
      data: {
        consumedAt: at,
      },
    });

    return result.count === 1;
  }

  public async secureSessionsAfterMfaEnable(input: {
    userId: string;
    currentSessionId: string;
    at: Date;
  }): Promise<void> {
    const current = await this.client.userSession.updateMany({
      where: {
        id: input.currentSessionId,
        userId: input.userId,
        status: 'ACTIVE',
      },
      data: {
        mfaVerifiedAt: input.at,
      },
    });

    if (current.count !== 1) {
      throw new IdentityError('SESSION_INVALID');
    }

    await this.client.userSession.updateMany({
      where: {
        userId: input.userId,
        id: {
          not: input.currentSessionId,
        },
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: input.at,
        revocationReason: 'MFA_ENABLED',
      },
    });
  }

  public async secureSessionsAfterMfaRotation(input: {
    userId: string;
    currentSessionId: string;
    at: Date;
  }): Promise<void> {
    const current = await this.client.userSession.updateMany({
      where: {
        id: input.currentSessionId,
        userId: input.userId,
        status: 'ACTIVE',
      },
      data: {
        mfaVerifiedAt: input.at,
      },
    });

    if (current.count !== 1) {
      throw new IdentityError('SESSION_INVALID');
    }

    await this.client.userSession.updateMany({
      where: {
        userId: input.userId,
        id: {
          not: input.currentSessionId,
        },
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: input.at,
        revocationReason: 'MFA_ROTATED',
      },
    });
  }
}

export class PrismaMfaTransactionManager implements MfaTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}

  public async transaction<T>(operation: (repository: MfaRepository) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction((transaction) =>
        operation(new PrismaMfaRepository(transaction)),
      );
    } catch (error) {
      if (error instanceof IdentityError) {
        throw error;
      }

      throw persistenceError(error);
    }
  }
}
