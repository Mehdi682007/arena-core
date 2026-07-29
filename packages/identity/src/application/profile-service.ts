import { ProfileError } from '../domain/profile-errors';
import {
  calculateOnboardingStatus,
  normalizeCountryCode,
  normalizeDisplayName,
  normalizeProfileLocale,
  normalizeTimezone,
} from '../domain/profile-policies';
import type {
  IdentityOnboardingState,
  OnboardingStatus,
  ProfileResult,
  UpdateProfileInput,
  UpsertProfileInput,
  UserProfileRecord,
  UserProfileView,
} from '../domain/profile-types';
import type { UserProfileRepository } from '../ports/user-profile-repository';

function view(profile: UserProfileRecord | null): UserProfileView {
  return Object.freeze(
    profile === null
      ? {
          displayName: null,
          locale: 'fa',
          timezone: null,
          countryCode: null,
          createdAt: null,
          updatedAt: null,
        }
      : {
          displayName: profile.displayName,
          locale: profile.locale,
          timezone: profile.timezone,
          countryCode: profile.countryCode,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
  );
}

function assertReadable(state: IdentityOnboardingState | null): asserts state {
  if (state === null || state.status === 'DISABLED' || state.status === 'DELETED') {
    throw new ProfileError('PROFILE_NOT_AVAILABLE');
  }
}

function assertWritable(state: IdentityOnboardingState): void {
  if (!['ACTIVE', 'PENDING_VERIFICATION'].includes(state.status) || state.deletedAt !== null) {
    throw new ProfileError('IDENTITY_NOT_ACTIVE');
  }
}

export class UserProfileService {
  public constructor(private readonly repository: UserProfileRepository) {}

  public async getCurrentUserProfile(userId: string): Promise<ProfileResult> {
    const state = await this.repository.findIdentityOnboardingState(userId);
    assertReadable(state);
    return Object.freeze({
      profile: view(state.profile),
      onboarding: calculateOnboardingStatus(state),
    });
  }

  public async upsertCurrentUserProfile(input: UpsertProfileInput): Promise<ProfileResult> {
    return this.update({
      userId: input.userId,
      displayName: input.displayName,
      locale: input.locale,
      timezone: input.timezone,
      countryCode: input.countryCode ?? null,
    });
  }

  public async updateCurrentUserProfile(input: UpdateProfileInput): Promise<ProfileResult> {
    return this.update(input);
  }

  public async updateDisplayName(userId: string, displayName: string): Promise<ProfileResult> {
    return this.update({ userId, displayName });
  }

  public async updateLocale(userId: string, locale: string): Promise<ProfileResult> {
    return this.update({ userId, locale });
  }

  public async updateTimezone(userId: string, timezone: string): Promise<ProfileResult> {
    return this.update({ userId, timezone });
  }

  public async updateCountry(userId: string, countryCode: string | null): Promise<ProfileResult> {
    return this.update({ userId, countryCode });
  }

  public async getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
    const state = await this.repository.findIdentityOnboardingState(userId);
    assertReadable(state);
    return calculateOnboardingStatus(state);
  }

  public async completeIdentityOnboarding(userId: string): Promise<OnboardingStatus> {
    const state = await this.repository.findIdentityOnboardingState(userId);
    assertReadable(state);
    const status = calculateOnboardingStatus(state);
    if (!status.completed) throw new ProfileError('ONBOARDING_INCOMPLETE');
    return status;
  }

  private async update(input: UpdateProfileInput): Promise<ProfileResult> {
    const state = await this.repository.findIdentityOnboardingState(input.userId);
    assertReadable(state);
    assertWritable(state);
    const current = state.profile;
    if (
      current === null &&
      (input.displayName === undefined ||
        input.locale === undefined ||
        input.timezone === undefined)
    ) {
      throw new ProfileError('PROFILE_NOT_AVAILABLE');
    }
    const profile = await this.repository.upsertProfile({
      userId: input.userId,
      displayName: normalizeDisplayName(input.displayName ?? current?.displayName ?? ''),
      locale: normalizeProfileLocale(input.locale ?? current?.locale ?? ''),
      timezone: normalizeTimezone(input.timezone ?? current?.timezone ?? ''),
      countryCode:
        input.countryCode === undefined
          ? (current?.countryCode ?? null)
          : normalizeCountryCode(input.countryCode),
    });
    const nextState = Object.freeze({ ...state, profile });
    return Object.freeze({
      profile: view(profile),
      onboarding: calculateOnboardingStatus(nextState),
    });
  }
}
