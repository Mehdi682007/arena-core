import { ProfileError } from './profile-errors';
import type {
  IdentityOnboardingState,
  OnboardingStep,
  OnboardingStatus,
  ProfileLocale,
  UserProfileRecord,
} from './profile-types';

const fixedOffset = /^(?:GMT|UTC)?[+-]\d{1,2}(?::?\d{2})?$/i;

function containsUnsafeDisplayCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x206f)
    ) {
      return true;
    }
  }
  return false;
}

export function normalizeDisplayName(value: string): string {
  const normalized = value.trim().normalize('NFC');
  const length = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized),
  ).length;
  if (length < 2 || length > 40 || containsUnsafeDisplayCharacter(normalized)) {
    throw new ProfileError('INVALID_DISPLAY_NAME');
  }
  return normalized;
}

export function normalizeProfileLocale(value: string): ProfileLocale {
  if (value !== 'fa' && value !== 'en') throw new ProfileError('INVALID_LOCALE');
  return value;
}

export function normalizeTimezone(value: string): string {
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > 64 ||
    fixedOffset.test(candidate) ||
    /[:?#\\]/.test(candidate)
  ) {
    throw new ProfileError('INVALID_TIMEZONE');
  }
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    throw new ProfileError('INVALID_TIMEZONE');
  }
}

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new ProfileError('INVALID_COUNTRY_CODE');
  return normalized;
}

function profileComplete(profile: UserProfileRecord | null): boolean {
  if (profile === null) return false;
  try {
    normalizeDisplayName(profile.displayName);
    normalizeProfileLocale(profile.locale);
    return true;
  } catch {
    return false;
  }
}

function timezoneComplete(profile: UserProfileRecord | null): boolean {
  if (profile === null) return false;
  try {
    normalizeTimezone(profile.timezone);
    return true;
  } catch {
    return false;
  }
}

export function calculateOnboardingStatus(state: IdentityOnboardingState): OnboardingStatus {
  const missingSteps: OnboardingStep[] = [];
  if (
    state.status === 'PENDING_VERIFICATION' ||
    !state.primaryEmailVerified ||
    state.deletedAt !== null
  ) {
    missingSteps.push('VERIFY_EMAIL');
  }
  if (!profileComplete(state.profile)) missingSteps.push('COMPLETE_PROFILE');
  if (!timezoneComplete(state.profile)) missingSteps.push('SET_TIMEZONE');
  return Object.freeze({
    completed:
      state.status === 'ACTIVE' &&
      state.deletedAt === null &&
      state.primaryEmailVerified &&
      missingSteps.length === 0,
    missingSteps: Object.freeze(missingSteps),
  });
}
