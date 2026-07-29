import type { UserStatus } from './identity-types';

export type ProfileLocale = 'fa' | 'en';
export type OnboardingStep = 'VERIFY_EMAIL' | 'COMPLETE_PROFILE' | 'SET_TIMEZONE';

export interface UserProfileRecord {
  readonly userId: string;
  readonly displayName: string;
  readonly locale: ProfileLocale;
  readonly timezone: string;
  readonly countryCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IdentityOnboardingState {
  readonly userId: string;
  readonly status: UserStatus;
  readonly deletedAt: Date | null;
  readonly primaryEmailVerified: boolean;
  readonly profile: UserProfileRecord | null;
}

export interface OnboardingStatus {
  readonly completed: boolean;
  readonly missingSteps: readonly OnboardingStep[];
}

export interface UserProfileView {
  readonly displayName: string | null;
  readonly locale: ProfileLocale;
  readonly timezone: string | null;
  readonly countryCode: string | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface ProfileResult {
  readonly profile: UserProfileView;
  readonly onboarding: OnboardingStatus;
}

export interface UpdateProfileInput {
  readonly userId: string;
  readonly displayName?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly countryCode?: string | null;
}

export interface UpsertProfileInput {
  readonly userId: string;
  readonly displayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly countryCode?: string | null;
}
