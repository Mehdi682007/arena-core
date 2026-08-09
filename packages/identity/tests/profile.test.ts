import { describe, expect, it, vi } from 'vitest';
import {
  calculateOnboardingStatus,
  normalizeCountryCode,
  normalizeDisplayName,
  normalizeProfileLocale,
  normalizeTimezone,
  ProfileError,
  UserProfileService,
  type IdentityOnboardingState,
  type UpsertUserProfileRecord,
  type UserProfileRecord,
  type UserProfileRepository,
} from '../src';

const profile: UserProfileRecord = Object.freeze({
  userId: 'user-1',
  displayName: 'Mehdi',
  locale: 'fa',
  timezone: 'Asia/Tehran',
  countryCode: 'IR',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

function state(overrides: Partial<IdentityOnboardingState> = {}): IdentityOnboardingState {
  return Object.freeze({
    userId: 'user-1',
    status: 'ACTIVE',
    deletedAt: null,
    primaryEmailVerified: true,
    profile,
    ...overrides,
  });
}

class MemoryProfileRepository implements UserProfileRepository {
  public current: IdentityOnboardingState | null = state();
  public readonly upsertProfile = vi.fn(
    async (input: UpsertUserProfileRecord): Promise<UserProfileRecord> => {
      const record = Object.freeze({
        ...input,
        createdAt: this.current?.profile?.createdAt ?? new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      });
      if (this.current !== null) this.current = Object.freeze({ ...this.current, profile: record });
      return record;
    },
  );

  public findProfileByUserId(): Promise<UserProfileRecord | null> {
    return Promise.resolve(this.current?.profile ?? null);
  }

  public findIdentityOnboardingState(): Promise<IdentityOnboardingState | null> {
    return Promise.resolve(this.current);
  }
}

describe('profile validation policies', () => {
  it.each([
    [' مهدی ', 'مهدی'],
    ['Mehdi', 'Mehdi'],
    ['Player 🎮', 'Player 🎮'],
    ['e\u0301ric', 'éric'],
    ['A  B', 'A  B'],
  ])('normalizes a valid display name', (input, expected) => {
    expect(normalizeDisplayName(input)).toBe(expected);
  });

  it.each(['', ' ', 'a', 'x'.repeat(41), 'line\nbreak', 'bad\u0000name', 'abc\u202ename'])(
    'rejects unsafe display names',
    (input) => {
      expect(() => normalizeDisplayName(input)).toThrow(ProfileError);
    },
  );

  it.each([
    ['fa', 'fa'],
    ['en', 'en'],
  ])('accepts supported locale', (input, expected) => {
    expect(normalizeProfileLocale(input)).toBe(expected);
  });

  it.each(['FA', 'de', ''])('rejects unsupported locale', (input) => {
    expect(() => normalizeProfileLocale(input)).toThrow(ProfileError);
  });

  it.each(['Asia/Tehran', 'UTC', 'Europe/Berlin'])('accepts IANA timezone %s', (input) => {
    expect(normalizeTimezone(input)).toBeTruthy();
  });

  it.each(['', 'GMT+3:30', '+03:30', 'IRST', '../zone', 'https://example.com', 'x'.repeat(65)])(
    'rejects invalid timezone %s',
    (input) => {
      expect(() => normalizeTimezone(input)).toThrow(ProfileError);
    },
  );

  it.each([
    ['IR', 'IR'],
    ['de', 'DE'],
    ['', null],
    [null, null],
  ])('normalizes country code', (input, expected) => {
    expect(normalizeCountryCode(input)).toBe(expected);
  });

  it.each(['I', '123', 'ای', 'USA'])('rejects invalid country code', (input) => {
    expect(() => normalizeCountryCode(input)).toThrow(ProfileError);
  });
});

describe('identity onboarding policy', () => {
  it.each([
    [state(), true, []],
    [
      state({ status: 'PENDING_VERIFICATION', primaryEmailVerified: false }),
      false,
      ['VERIFY_EMAIL'],
    ],
    [state({ profile: null }), false, ['COMPLETE_PROFILE', 'SET_TIMEZONE']],
    [state({ profile: { ...profile, timezone: 'invalid' } }), false, ['SET_TIMEZONE']],
    [state({ status: 'SUSPENDED' }), false, []],
    [state({ status: 'DISABLED' }), false, []],
    [state({ status: 'DELETED', deletedAt: new Date() }), false, ['VERIFY_EMAIL']],
  ])('calculates deterministic onboarding state', (input, completed, missingSteps) => {
    expect(calculateOnboardingStatus(input)).toEqual({ completed, missingSteps });
  });
});

describe('user profile application service', () => {
  it('returns an explicit public allowlist and rejects non-active profiles', async () => {
    const repository = new MemoryProfileRepository();
    const service = new UserProfileService(repository);
    await expect(service.getPublicProfile('user-1')).resolves.toEqual({
      userId: 'user-1',
      displayName: 'Mehdi',
    });
    expect(JSON.stringify(await service.getPublicProfile('user-1'))).not.toMatch(
      /locale|timezone|country|email|session|security|onboarding/i,
    );
    repository.current = state({ status: 'SUSPENDED' });
    await expect(service.getPublicProfile('user-1')).rejects.toMatchObject({
      code: 'PROFILE_NOT_AVAILABLE',
    });
  });

  it('returns an existing safe profile and a base view for a missing profile', async () => {
    const repository = new MemoryProfileRepository();
    const service = new UserProfileService(repository);
    await expect(service.getCurrentUserProfile('user-1')).resolves.toMatchObject({
      profile: { displayName: 'Mehdi', locale: 'fa', timezone: 'Asia/Tehran' },
      onboarding: { completed: true },
    });
    repository.current = state({ profile: null });
    await expect(service.getCurrentUserProfile('user-1')).resolves.toMatchObject({
      profile: { displayName: null, locale: 'fa', timezone: null, countryCode: null },
      onboarding: { completed: false },
    });
  });

  it('creates, partially updates, and clears country through normalized writes', async () => {
    const repository = new MemoryProfileRepository();
    repository.current = state({ profile: null });
    const service = new UserProfileService(repository);
    await service.upsertCurrentUserProfile({
      userId: 'user-1',
      displayName: ' مهدی ',
      locale: 'fa',
      timezone: 'Asia/Tehran',
      countryCode: 'ir',
    });
    expect(repository.upsertProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'مهدی', countryCode: 'IR' }),
    );
    await service.updateLocale('user-1', 'en');
    await service.updateCountry('user-1', null);
    expect(repository.upsertProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ locale: 'en', countryCode: null }),
    );
  });

  it('allows pending profile writes but rejects suspended writes and unavailable identities', async () => {
    const repository = new MemoryProfileRepository();
    const service = new UserProfileService(repository);
    repository.current = state({ status: 'PENDING_VERIFICATION' });
    await expect(service.updateDisplayName('user-1', 'Pending User')).resolves.toBeTruthy();
    repository.current = state({ status: 'SUSPENDED' });
    await expect(service.getCurrentUserProfile('user-1')).resolves.toBeTruthy();
    await expect(service.updateDisplayName('user-1', 'Blocked User')).rejects.toMatchObject({
      code: 'IDENTITY_NOT_ACTIVE',
    });
    repository.current = null;
    await expect(service.getCurrentUserProfile('user-1')).rejects.toMatchObject({
      code: 'PROFILE_NOT_AVAILABLE',
    });
  });

  it('completes onboarding idempotently only when derived state is complete', async () => {
    const repository = new MemoryProfileRepository();
    const service = new UserProfileService(repository);
    await expect(service.completeIdentityOnboarding('user-1')).resolves.toEqual({
      completed: true,
      missingSteps: [],
    });
    await expect(service.completeIdentityOnboarding('user-1')).resolves.toEqual({
      completed: true,
      missingSteps: [],
    });
    repository.current = state({ profile: null });
    await expect(service.completeIdentityOnboarding('user-1')).rejects.toMatchObject({
      code: 'ONBOARDING_INCOMPLETE',
    });
  });

  it('preserves sanitized persistence failures', async () => {
    const repository = new MemoryProfileRepository();
    repository.upsertProfile.mockRejectedValueOnce(
      new ProfileError('IDENTITY_PROFILE_PERSISTENCE_FAILURE', {
        cause: new Error('postgresql://secret'),
      }),
    );
    const service = new UserProfileService(repository);
    try {
      await service.updateTimezone('user-1', 'UTC');
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileError);
      expect(JSON.stringify(error)).not.toContain('postgresql://secret');
    }
  });
});
