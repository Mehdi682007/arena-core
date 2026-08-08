import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { Avatar, Badge } from '@/components/ui';
import { LogoutButton } from '@/features/session/logout-button';
import type { SessionUser } from '@/features/session/session';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';

function Navigation({ locale }: { locale: AppLocale }) {
  const messages = messagesFor(locale).appShell;

  const navigation = [
    ['/dashboard', messages.dashboard],
    ['/matchmaking', messages.matchmaking],
    ['/matches', messages.matches],
    ['/profile', messages.profile],
    ['/notifications', messages.notifications],
    ['/leaderboards', messages.leaderboards],
    ['/settings', messages.settings],
  ] as const;

  return (
    <>
      {navigation.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}

      <LogoutButton locale={locale} />
    </>
  );
}

export function PublicShell({
  children,
  locale = 'fa',
}: {
  children: ReactNode;
  locale?: AppLocale;
}) {
  const messages = messagesFor(locale).publicShell;

  return (
    <>
      <header className="public-header">
        <div className="container">
          <Link className="brand" href="/">
            Arena Core
          </Link>

          <nav aria-label={messages.accountNavigation} className="cluster">
            <LanguageToggle initialLocale={locale} compact />

            <Link href="/login">{messages.login}</Link>

            <Link className="button" href="/register">
              {messages.register}
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="public-footer">
        <div className="container">{messages.footer}</div>
      </footer>
    </>
  );
}

export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  children: ReactNode;
}) {
  const locale = user.locale;
  const messages = messagesFor(locale).appShell;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          Arena Core
        </Link>

        <nav aria-label={messages.mainNavigation} className="stack">
          <Navigation locale={locale} />
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="cluster">
            <Avatar name={user.displayName} />
            <span>{user.displayName}</span>
          </div>

          <div className="cluster">
            <LanguageToggle compact initialLocale={locale} persistProfile />

            <Link href="/notifications" aria-label={messages.unreadNotifications(unreadCount)}>
              {messages.notifications}{' '}
              {unreadCount > 0 ? (
                <Badge>
                  {new Intl.NumberFormat(locale === 'fa' ? 'fa' : 'en-US').format(unreadCount)}
                </Badge>
              ) : null}
            </Link>
          </div>
        </header>

        <main id="main-content" className="content">
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label={messages.mobileNavigation}>
        <Navigation locale={locale} />
      </nav>
    </div>
  );
}
