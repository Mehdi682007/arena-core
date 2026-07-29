export type ProfileErrorCode =
  | 'PROFILE_NOT_AVAILABLE'
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_LOCALE'
  | 'INVALID_TIMEZONE'
  | 'INVALID_COUNTRY_CODE'
  | 'PROFILE_UPDATE_CONFLICT'
  | 'ONBOARDING_INCOMPLETE'
  | 'IDENTITY_NOT_ACTIVE'
  | 'IDENTITY_PROFILE_PERSISTENCE_FAILURE'
  | 'PROFILE_DATABASE_DISABLED';

const messages: Record<ProfileErrorCode, string> = {
  PROFILE_NOT_AVAILABLE: 'Profile is not available.',
  INVALID_DISPLAY_NAME: 'Display name is invalid.',
  INVALID_LOCALE: 'Locale is invalid.',
  INVALID_TIMEZONE: 'Timezone is invalid.',
  INVALID_COUNTRY_CODE: 'Country code is invalid.',
  PROFILE_UPDATE_CONFLICT: 'Profile update conflicts with existing state.',
  ONBOARDING_INCOMPLETE: 'Identity onboarding is incomplete.',
  IDENTITY_NOT_ACTIVE: 'Identity is not active.',
  IDENTITY_PROFILE_PERSISTENCE_FAILURE: 'Profile persistence operation failed.',
  PROFILE_DATABASE_DISABLED: 'Profile persistence is disabled.',
};

export class ProfileError extends Error {
  public constructor(
    public readonly code: ProfileErrorCode,
    options?: ErrorOptions,
  ) {
    super(messages[code], options);
    this.name = 'ProfileError';
  }

  public toJSON(): Readonly<{ code: ProfileErrorCode; message: string }> {
    return Object.freeze({ code: this.code, message: this.message });
  }
}
