import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { PrismaUserProfileRepository, ProfileError } from '../src';

const storedProfile = {
  userId: 'user-1',
  displayName: 'Mehdi',
  locale: 'fa',
  timezone: 'Asia/Tehran',
  countryCode: 'IR',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

function repositoryWith(client: object): PrismaUserProfileRepository {
  return new PrismaUserProfileRepository(client as unknown as ArenaPrismaClient);
}

describe('Prisma user profile repository query contracts', () => {
  it('uses a limited profile select and maps framework-neutral data', async () => {
    const findUnique = vi.fn(async () => storedProfile);
    const repository = repositoryWith({ userProfile: { findUnique } });
    await expect(repository.findProfileByUserId('user-1')).resolves.toEqual(storedProfile);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        userId: true,
        displayName: true,
        locale: true,
        timezone: true,
        countryCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(JSON.stringify(findUnique.mock.calls[0])).not.toMatch(
      /password|token|session|securityVersion/i,
    );
  });

  it('upserts only profile fields and returns a safe record', async () => {
    let capturedUpsert: unknown;
    const upsert = vi.fn(async (input: unknown) => {
      capturedUpsert = input;
      return storedProfile;
    });
    const repository = repositoryWith({ userProfile: { upsert } });
    await repository.upsertProfile({
      userId: 'user-1',
      displayName: 'Mehdi',
      locale: 'fa',
      timezone: 'Asia/Tehran',
      countryCode: 'IR',
    });
    expect(capturedUpsert).toMatchObject({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', countryCode: 'IR' },
      update: { countryCode: 'IR' },
    });
    expect(JSON.stringify(capturedUpsert)).not.toContain('"update":{"userId"');
  });

  it('loads onboarding in one limited projection', async () => {
    let capturedQuery: unknown;
    const findUnique = vi.fn(async (query: unknown) => {
      capturedQuery = query;
      return {
        id: 'user-1',
        status: 'ACTIVE',
        deletedAt: null,
        profile: storedProfile,
        emails: [{ verifiedAt: new Date('2026-01-01T00:00:00Z') }],
      };
    });
    const repository = repositoryWith({ user: { findUnique } });
    await expect(repository.findIdentityOnboardingState('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      status: 'ACTIVE',
      primaryEmailVerified: true,
      profile: { displayName: 'Mehdi' },
    });
    expect(capturedQuery).toMatchObject({
      where: { id: 'user-1' },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        emails: {
          where: { isPrimary: true },
          select: { verifiedAt: true },
          take: 1,
        },
      },
    });
    expect(JSON.stringify(capturedQuery)).not.toMatch(/password|token|session|securityVersion/i);
  });

  it('sanitizes unknown persistence errors and invalid stored locale', async () => {
    const persistence = repositoryWith({
      user: {
        findUnique: vi.fn(async () => {
          throw new Error('postgresql://user:secret@host/database');
        }),
      },
    });
    try {
      await persistence.findIdentityOnboardingState('user-1');
      throw new Error('expected persistence failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileError);
      expect(JSON.stringify(error)).not.toContain('secret');
    }

    const invalid = repositoryWith({
      userProfile: { findUnique: vi.fn(async () => ({ ...storedProfile, locale: 'de' })) },
    });
    await expect(invalid.findProfileByUserId('user-1')).rejects.toMatchObject({
      code: 'IDENTITY_PROFILE_PERSISTENCE_FAILURE',
    });
  });
});
