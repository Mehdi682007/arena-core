import { Prisma, type ArenaPrismaClient } from '@arena-core/database';
import { IdentityError } from '../domain/identity-errors';
import type { UserSecurityRecord } from '../domain/identity-types';
import type {
  PhoneIdentityRecord,
  PhoneOtpChallengeRecord,
  UserPhoneView,
} from '../domain/phone-identity-types';
import type {
  PhoneIdentityRepository,
  PhoneIdentityTransactionManager,
} from '../ports/phone-identity-repository';

type PhonePrismaClient = ArenaPrismaClient | Prisma.TransactionClient;

const userSecuritySelect = {
  id: true,
  status: true,
  securityVersion: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

const phoneSelect = {
  id: true,
  userId: true,
  phoneE164: true,
  isPrimary: true,
  verifiedAt: true,
  createdAt: true,
  user: {
    select: userSecuritySelect,
  },
} satisfies Prisma.UserPhoneSelect;

type PhoneRow = Prisma.UserPhoneGetPayload<{
  select: typeof phoneSelect;
}>;

function identity(row: PhoneRow): PhoneIdentityRecord {
  return row;
}

function view(row: PhoneRow): UserPhoneView {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    isPrimary: row.isPrimary,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
  };
}

function persistenceError(error: unknown): IdentityError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new IdentityError('PHONE_ALREADY_IN_USE', { cause: error });
  }

  return new IdentityError('IDENTITY_PERSISTENCE_FAILURE', { cause: error });
}

export class PrismaPhoneIdentityRepository implements PhoneIdentityRepository {
  public constructor(private readonly client: PhonePrismaClient) {}

  public findUser(userId: string): Promise<UserSecurityRecord | null> {
    return this.client.user.findUnique({
      where: {
        id: userId,
      },
      select: userSecuritySelect,
    });
  }

  public async findPhoneByE164(phoneE164: string): Promise<PhoneIdentityRecord | null> {
    const row = await this.client.userPhone.findUnique({
      where: {
        phoneE164,
      },
      select: phoneSelect,
    });

    return row === null ? null : identity(row);
  }

  public async findVerifiedPhoneByE164(phoneE164: string): Promise<PhoneIdentityRecord | null> {
    const row = await this.client.userPhone.findFirst({
      where: {
        phoneE164,
        verifiedAt: {
          not: null,
        },
      },
      select: phoneSelect,
    });

    return row === null ? null : identity(row);
  }

  public async listUserPhones(userId: string): Promise<readonly UserPhoneView[]> {
    const rows = await this.client.userPhone.findMany({
      where: {
        userId,
      },
      select: phoneSelect,
      orderBy: [
        {
          isPrimary: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return rows.map(view);
  }

  public async createOtpChallenge(input: {
    userId?: string;
    userPhoneId?: string;
    phoneE164: string;
    purpose: 'SIGN_IN' | 'VERIFY_PHONE' | 'CHANGE_PHONE' | 'RECOVERY';
    codeHash: string;
    expiresAt: Date;
    maxAttempts: number;
    requestedIpHash?: string;
  }): Promise<{
    id: string;
    createdAt: Date;
  }> {
    return this.client.phoneOtpChallenge.create({
      data: {
        ...(input.userId === undefined
          ? {}
          : {
              userId: input.userId,
            }),
        ...(input.userPhoneId === undefined
          ? {}
          : {
              userPhoneId: input.userPhoneId,
            }),
        phoneE164: input.phoneE164,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts,
        ...(input.requestedIpHash === undefined
          ? {}
          : {
              requestedIpHash: input.requestedIpHash,
            }),
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  public async findOtpChallenge(challengeId: string): Promise<PhoneOtpChallengeRecord | null> {
    const row = await this.client.phoneOtpChallenge.findUnique({
      where: {
        id: challengeId,
      },
      select: {
        id: true,
        userId: true,
        userPhoneId: true,
        phoneE164: true,
        purpose: true,
        codeHash: true,
        createdAt: true,
        expiresAt: true,
        consumedAt: true,
        attemptCount: true,
        maxAttempts: true,
        requestedIpHash: true,
        userPhone: {
          select: phoneSelect,
        },
      },
    });

    if (row === null) {
      return null;
    }

    return {
      ...row,
      userPhone: row.userPhone === null ? null : identity(row.userPhone),
    };
  }

  public async recordOtpFailure(challengeId: string): Promise<void> {
    await this.client.phoneOtpChallenge.updateMany({
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

  public async consumeOtpChallenge(challengeId: string, at: Date): Promise<boolean> {
    const result = await this.client.phoneOtpChallenge.updateMany({
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

  public async verifyPhoneAndConsumeChallenge(input: {
    challengeId: string;
    userId: string;
    phoneE164: string;
    at: Date;
  }): Promise<UserPhoneView> {
    const existing = await this.client.userPhone.findUnique({
      where: {
        phoneE164: input.phoneE164,
      },
      select: phoneSelect,
    });

    if (existing !== null && existing.userId !== input.userId) {
      throw new IdentityError('PHONE_ALREADY_IN_USE');
    }

    const currentPrimary = await this.client.userPhone.findFirst({
      where: {
        userId: input.userId,
        isPrimary: true,
        verifiedAt: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

    const row =
      existing === null
        ? await this.client.userPhone.create({
            data: {
              userId: input.userId,
              phoneE164: input.phoneE164,
              verifiedAt: input.at,
              isPrimary: currentPrimary === null,
            },
            select: phoneSelect,
          })
        : await this.client.userPhone.update({
            where: {
              id: existing.id,
            },
            data: {
              verifiedAt: input.at,
              isPrimary: existing.isPrimary || currentPrimary === null,
            },
            select: phoneSelect,
          });

    const consumed = await this.client.phoneOtpChallenge.updateMany({
      where: {
        id: input.challengeId,
        userId: input.userId,
        purpose: 'VERIFY_PHONE',
        consumedAt: null,
      },
      data: {
        consumedAt: input.at,
      },
    });

    if (consumed.count !== 1) {
      throw new IdentityError('INVALID_PHONE_OTP');
    }

    return view(row);
  }
}

export class PrismaPhoneIdentityTransactionManager implements PhoneIdentityTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}

  public async transaction<T>(
    operation: (repository: PhoneIdentityRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction((transaction) =>
        operation(new PrismaPhoneIdentityRepository(transaction)),
      );
    } catch (error) {
      if (error instanceof IdentityError) {
        throw error;
      }

      throw persistenceError(error);
    }
  }
}
