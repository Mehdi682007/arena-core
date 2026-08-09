import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { Avatar, Badge } from '@/components/ui';
import { LogoutButton } from '@/features/session/logout-button';
import { ThemeToggle } from '@/features/admin/theme-toggle';
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
  branding,
}: {
  children: ReactNode;
  locale?: AppLocale;
  branding?: {
    name: string;
    logoLight?: { url: string; alt: string };
    logoDark?: { url: string; alt: string };
    footer?: string;
    legal?: readonly { label: string; url: string }[];
  };
}) {
  const messages = messagesFor(locale).publicShell;

  return (
    <>
      <header className="public-header">
        <div className="container">
          <Link className="brand" href="/">
            {branding?.logoLight?.url ? (
              <Image
                className="brand-logo brand-logo-light"
                src={branding.logoLight.url}
                alt={branding.logoLight.alt}
                width={160}
                height={48}
                unoptimized
              />
            ) : null}
            {branding?.logoDark?.url ? (
              <Image
                className="brand-logo brand-logo-dark"
                src={branding.logoDark.url}
                alt={branding.logoDark.alt}
                width={160}
                height={48}
                unoptimized
              />
            ) : null}
            {!branding?.logoLight?.url && !branding?.logoDark?.url
              ? (branding?.name ?? 'Arena Core')
              : null}
          </Link>

          <nav aria-label={messages.accountNavigation} className="cluster">
            <ThemeToggle locale={locale} />
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
        <div className="container cluster">
          <span>{branding?.footer ?? messages.footer}</span>
          {branding?.legal?.map((item) => (
            <Link key={item.url} href={item.url}>
              {item.label}
            </Link>
          ))}
        </div>
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
            <ThemeToggle locale={locale} />
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
