import 'server-only';
import { ApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: {
    readonly displayName: string | null;
    readonly locale: 'fa' | 'en';
    readonly timezone: string | null;
    readonly countryCode: string | null;
  };
  readonly onboarding: { readonly completed: boolean; readonly missingSteps: readonly string[] };
}
export interface SessionUser {
  readonly displayName: string;
  readonly locale: 'fa' | 'en';
  readonly timezone: string | null;
  readonly countryCode: string | null;
  readonly emailVerified: boolean;
  readonly onboardingCompleted: boolean;
  readonly roles?: readonly string[];
}
export type SessionState =
  | { readonly status: 'authenticated'; readonly user: SessionUser }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unavailable'; readonly requestId?: string };

export async function getSession(): Promise<SessionState> {
  try {
    await serverApi('/auth/me');
    const profile = await serverApi<ProfileResponse>('/profile');
    const locale = profile.profile.locale;
    return {
      status: 'authenticated',
      user: {
        displayName: profile.profile.displayName ?? (locale === 'fa' ? 'کاربر آرنا' : 'Arena user'),
        locale,
        timezone: profile.profile.timezone,
        countryCode: profile.profile.countryCode,
        emailVerified: !profile.onboarding.missingSteps.includes('VERIFY_EMAIL'),
        onboardingCompleted: profile.onboarding.completed,
      },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'unauthenticated' };
    return {
      status: 'unavailable',
      ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
    };
  }
}
