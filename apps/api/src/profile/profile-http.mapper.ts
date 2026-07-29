import type { ProfileResult } from '@arena-core/identity';

export function profileResponse(result: ProfileResult): Readonly<{
  profile: Readonly<{
    displayName: string | null;
    locale: 'fa' | 'en';
    timezone: string | null;
    countryCode: string | null;
  }>;
  onboarding: ProfileResult['onboarding'];
}> {
  return Object.freeze({
    profile: Object.freeze({
      displayName: result.profile.displayName,
      locale: result.profile.locale,
      timezone: result.profile.timezone,
      countryCode: result.profile.countryCode,
    }),
    onboarding: result.onboarding,
  });
}
