import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { Avatar, Badge } from '@/components/ui';
import type { SessionUser } from '@/features/session/session';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';

function navigation(locale: AppLocale) {
  const labels = messagesFor(locale).shell.navigation;
  return [
    ['/dashboard', labels.dashboard],
    ['/matchmaking', labels.matchmaking],
    ['/matches', labels.matches],
    ['/profile', labels.profile],
    ['/notifications', labels.notifications],
    ['/leaderboards', labels.leaderboards],
    ['/settings', labels.settings],
  ] as const;
}

export function PublicShell({ children, locale }: { children: ReactNode; locale: AppLocale }) {
  const messages = messagesFor(locale).shell;
  return (
    <>
      <header className="public-header">
        <div className="container">
          <Link className="brand" href="/">
            Arena Core
          </Link>

          <nav aria-label={messages.accountNavigation} className="cluster">
            <LanguageToggle compact initialLocale={locale} />
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

function Navigation({ locale }: { locale: AppLocale }) {
  return (
    <>
      {navigation(locale).map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
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
  const messages = messagesFor(locale).shell;
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
              {messages.navigation.notifications}{' '}
              {unreadCount > 0 ? (
                <Badge>
                  {new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(unreadCount)}
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
