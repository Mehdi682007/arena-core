import Link from 'next/link';
import { Card } from '@/components/ui';
import { LanguageToggle } from '@/components/language-toggle';
import { NotificationPreferences } from '@/features/notifications/preferences';
import { LogoutButton } from '@/features/session/logout-button';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: { readonly locale: AppLocale };
}

export default async function SettingsPage() {
  const [profile, preferences] = await Promise.all([
    serverApi<ProfileResponse>('/profile'),
    serverApi<Parameters<typeof NotificationPreferences>[0]['initial']>('/notification-preferences'),
  ]);
  const locale = profile.profile.locale;
  const messages = messagesFor(locale).settings;
  return (
    <div className="stack">
      <div>
        <h1>{messages.title}</h1>
        <p className="muted">{messages.accountDescription}</p>
      </div>

      <Card>
        <h2>{messages.accountTitle}</h2>
        <div className="cluster">
          <Link className="button secondary" href="/settings/profile">
            {messages.profileTitle}
          </Link>
          <Link className="button secondary" href="/settings/security">
            {messages.securityTitle}
          </Link>
          <Link className="button secondary" href="/settings/sessions">
            {messages.sessionsTitle}
          </Link>
        </div>
      </Card>

      <Card>
        <h2>{messages.languageAndSecurity}</h2>
        <p>
          {messages.currentLanguage}: {locale === 'fa' ? 'فارسی' : 'English'}
        </p>
        <LanguageToggle initialLocale={locale} persistProfile />
        <p>{messages.sessionCookieNotice}</p>
        <LogoutButton locale={locale} />
      </Card>

      <section>
        <h2>{messages.notificationsTitle}</h2>
        <NotificationPreferences initial={preferences} locale={locale} />
      </section>
    </div>
  );
}
