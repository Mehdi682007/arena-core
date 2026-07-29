import { Prisma, type ArenaPrismaClient } from '@arena-core/database';
import { ProfileError } from '../domain/profile-errors';
import type { IdentityOnboardingState, UserProfileRecord } from '../domain/profile-types';
import type {
  UpsertUserProfileRecord,
  UserProfileRepository,
} from '../ports/user-profile-repository';

type ProfilePrismaClient = ArenaPrismaClient | Prisma.TransactionClient;

const profileSelect = {
  userId: true,
  displayName: true,
  locale: true,
  timezone: true,
  countryCode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserProfileSelect;

function mapProfile(record: {
  userId: string;
  displayName: string;
  locale: string;
  timezone: string;
  countryCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserProfileRecord {
  if (record.locale !== 'fa' && record.locale !== 'en') {
    throw new ProfileError('IDENTITY_PROFILE_PERSISTENCE_FAILURE');
  }
  return Object.freeze({ ...record, locale: record.locale });
}

function persistenceError(error: unknown): ProfileError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ProfileError('PROFILE_UPDATE_CONFLICT', { cause: error });
  }
  return new ProfileError('IDENTITY_PROFILE_PERSISTENCE_FAILURE', { cause: error });
}

export class PrismaUserProfileRepository implements UserProfileRepository {
  public constructor(private readonly client: ProfilePrismaClient) {}

  public async findProfileByUserId(userId: string): Promise<UserProfileRecord | null> {
    const profile = await this.client.userProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });
    return profile === null ? null : mapProfile(profile);
  }

  public async upsertProfile(input: UpsertUserProfileRecord): Promise<UserProfileRecord> {
    try {
      const profile = await this.client.userProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          displayName: input.displayName,
          locale: input.locale,
          timezone: input.timezone,
          countryCode: input.countryCode,
        },
        update: {
          displayName: input.displayName,
          locale: input.locale,
          timezone: input.timezone,
          countryCode: input.countryCode,
        },
        select: profileSelect,
      });
      return mapProfile(profile);
    } catch (error) {
      throw persistenceError(error);
    }
  }

  public async findIdentityOnboardingState(
    userId: string,
  ): Promise<IdentityOnboardingState | null> {
    try {
      const user = await this.client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          profile: { select: profileSelect },
          emails: {
            where: { isPrimary: true },
            select: { verifiedAt: true },
            take: 1,
          },
        },
      });
      if (user === null) return null;
      return Object.freeze({
        userId: user.id,
        status: user.status,
        deletedAt: user.deletedAt,
        primaryEmailVerified: user.emails[0]?.verifiedAt != null,
        profile: user.profile === null ? null : mapProfile(user.profile),
      });
    } catch (error) {
      throw persistenceError(error);
    }
  }
}
