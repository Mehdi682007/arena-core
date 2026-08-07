import { SessionsPanel, type UserSessionItem } from '@/features/settings/sessions-panel';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: { readonly locale: AppLocale };
}

interface SessionsResponse {
  readonly sessions: readonly UserSessionItem[];
}

export default async function SessionsSettingsPage() {
  const [profile, sessions] = await Promise.all([
    serverApi<ProfileResponse>('/profile'),
    serverApi<SessionsResponse>('/auth/sessions'),
  ]);
  const locale = profile.profile.locale;
  const messages = messagesFor(locale).settings;
  return (
    <div className="stack">
      <div>
        <h1>{messages.sessionsTitle}</h1>
        <p className="muted">{messages.sessionsDescription}</p>
      </div>
      <SessionsPanel initial={sessions.sessions} locale={locale} />
    </div>
  );
}
