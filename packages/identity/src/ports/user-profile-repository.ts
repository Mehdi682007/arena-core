import type {
  IdentityOnboardingState,
  ProfileLocale,
  UserProfileRecord,
} from '../domain/profile-types';

export interface UpsertUserProfileRecord {
  readonly userId: string;
  readonly displayName: string;
  readonly locale: ProfileLocale;
  readonly timezone: string;
  readonly countryCode: string | null;
}

export interface UserProfileRepository {
  findProfileByUserId(userId: string): Promise<UserProfileRecord | null>;
  upsertProfile(input: UpsertUserProfileRecord): Promise<UserProfileRecord>;
  findIdentityOnboardingState(userId: string): Promise<IdentityOnboardingState | null>;
}
