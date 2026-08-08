import Link from 'next/link';
import { LanguageToggle } from '@/components/language-toggle';
import { Card } from '@/components/ui';
import { NotificationPreferences } from '@/features/notifications/preferences';
import { LogoutButton } from '@/features/session/logout-button';
import { getSession } from '@/features/session/session';
import { messagesFor } from '@/i18n/messages';
import { rc4MessagesFor } from '@/i18n/rc4-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function SettingsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const locale = session.user.locale;
  const rc4Messages = rc4MessagesFor(locale).settings;
  const messages = messagesFor(locale).settings;

  const preferences = await serverApi<Parameters<typeof NotificationPreferences>[0]['initial']>(
    '/notification-preferences',
  );

  return (
    <div className="stack">
      <div>
        <h1>{messages.title}</h1>

        <p className="muted">{messages.description}</p>
      </div>

      <Card>
        <h2>{messages.account}</h2>

        <div className="cluster">
          <Link className="button secondary" href="/profile">
            {messages.profile}
          </Link>

          <Link className="button secondary" href="/settings/security">
            {messages.security}
          </Link>

          <Link className="button secondary" href="/settings/sessions">
            {rc4Messages.sessions}
          </Link>

          <Link className="button secondary" href="/settings/phone">
            {rc4Messages.phone}
          </Link>

          <Link className="button secondary" href="/settings/game-accounts">
            {rc4Messages.gameAccounts}
          </Link>
        </div>
      </Card>

      <Card>
        <h2>{messages.languageAndSecurity}</h2>

        <p>
          {messages.currentLanguage}: {rc4Messages.currentLanguage}
        </p>

        <LanguageToggle initialLocale={locale} persistProfile />

        <p>{messages.sessionNotice}</p>

        <LogoutButton locale={locale} />
      </Card>

      <section>
        <h2>{messages.notifications}</h2>

        <NotificationPreferences initial={preferences} locale={locale} />
      </section>
    </div>
  );
}
