import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { Avatar, Badge } from '@/components/ui';
import type { SessionUser } from '@/features/session/session';

const navigation = [
  ['/dashboard', 'داشبورد'],
  ['/matchmaking', 'رقابت'],
  ['/matches', 'مسابقه‌ها'],
  ['/profile', 'پروفایل'],
  ['/notifications', 'اعلان‌ها'],
  ['/leaderboards', 'رتبه‌بندی'],
  ['/settings', 'تنظیمات'],
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="public-header">
        <div className="container">
          <Link className="brand" href="/">
            Arena Core
          </Link>

          <nav aria-label="حساب کاربری" className="cluster">
            <LanguageToggle compact />
            <Link href="/login">ورود</Link>
            <Link className="button" href="/register">
              ثبت‌نام
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="public-footer">
        <div className="container">بستر رقابت شفاف و غیرمالی — نسخه پایه</div>
      </footer>
    </>
  );
}

function Navigation() {
  return (
    <>
      {navigation.map(([href, label]) => (
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          Arena Core
        </Link>

        <nav aria-label="ناوبری اصلی" className="stack">
          <Navigation />
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="cluster">
            <Avatar name={user.displayName} />
            <span>{user.displayName}</span>
          </div>

          <div className="cluster">
            <LanguageToggle compact />

            <Link href="/notifications" aria-label={`${String(unreadCount)} اعلان خوانده‌نشده`}>
              اعلان‌ها{' '}
              {unreadCount > 0 ? (
                <Badge>{new Intl.NumberFormat('fa').format(unreadCount)}</Badge>
              ) : null}
            </Link>
          </div>
        </header>

        <main id="main-content" className="content">
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="ناوبری موبایل">
        <Navigation />
      </nav>
    </div>
  );
}
