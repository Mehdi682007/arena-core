'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AdminPermission } from './types';
import { ThemeToggle } from './theme-toggle';

type AdminNavigationItem = {
  href: string;
  label: string;
  description: string;
  symbol: string;
  permission?: AdminPermission;
};

type AdminNavigationGroup = {
  label: string;
  items: readonly AdminNavigationItem[];
};

const navigation: readonly AdminNavigationGroup[] = [
  {
    label: 'مرکز عملیات',
    items: [
      {
        href: '/admin',
        label: 'نمای کلی',
        description: 'سلامت و دسترسی‌های مدیریتی',
        symbol: '⌂',
      },
      {
        href: '/admin/search',
        label: 'جستجوی پشتیبانی',
        description: 'کاربر، مسابقه و حساب بازی',
        symbol: '⌕',
        permission: 'support.read',
      },
      {
        href: '/admin/diagnostics',
        label: 'وضعیت سرویس',
        description: 'نسخه، وابستگی‌ها و محیط',
        symbol: '◉',
        permission: 'diagnostics.read',
      },
      {
        href: '/admin/audit',
        label: 'رویدادهای ممیزی',
        description: 'ردپای عملیات حساس',
        symbol: '≣',
        permission: 'audit.read',
      },
    ],
  },
  {
    label: 'رقابت و بازیکنان',
    items: [
      {
        href: '/admin/game-accounts',
        label: 'حساب‌های بازی',
        description: 'بررسی و تأیید حساب‌ها',
        symbol: '◎',
        permission: 'game_accounts.read',
      },
      {
        href: '/admin/matches',
        label: 'مسابقه‌ها',
        description: 'وضعیت و جریان مسابقات',
        symbol: '⚔',
        permission: 'matches.read',
      },
      {
        href: '/admin/results',
        label: 'تعارض نتیجه‌ها',
        description: 'نتایج نیازمند تصمیم',
        symbol: '≠',
        permission: 'match_results.read',
      },
      {
        href: '/admin/disputes',
        label: 'اختلاف‌ها',
        description: 'صف بررسی اختلافات',
        symbol: '⚖',
        permission: 'match_disputes.read',
      },
      {
        href: '/admin/matchmaking',
        label: 'همتایابی',
        description: 'درخواست‌ها و پیشنهادها',
        symbol: '⇄',
        permission: 'matchmaking.read',
      },
      {
        href: '/admin/ratings',
        label: 'رتبه‌بندی',
        description: 'اعمال و بازبینی امتیازها',
        symbol: '★',
        permission: 'ratings.read',
      },
    ],
  },
  {
    label: 'مالی',
    items: [
      {
        href: '/admin/wallets',
        label: 'کیف پول و دفترکل',
        description: 'موجودی و تراکنش‌ها',
        symbol: '◈',
        permission: 'wallets.read',
      },
      {
        href: '/admin/finance',
        label: 'مالی مسابقه',
        description: 'رزرو و بازپرداخت',
        symbol: '▣',
        permission: 'match_finance.read',
      },
      {
        href: '/admin/settlements',
        label: 'تسویه‌ها',
        description: 'تسویه و تطبیق مالی',
        symbol: '✓',
        permission: 'match_settlements.read',
      },
    ],
  },
  {
    label: 'ارتباطات و بازیابی',
    items: [
      {
        href: '/admin/notifications',
        label: 'اعلان‌ها',
        description: 'Outbox و Dead-letter',
        symbol: '✦',
        permission: 'notifications.read',
      },
      {
        href: '/admin/support',
        label: 'عملیات پشتیبانی',
        description: 'بازیابی کنترل‌شده',
        symbol: '⚙',
        permission: 'support.manage',
      },
    ],
  },
];

const isActiveRoute = (pathname: string, href: string) =>
  href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function AdminOperationsShell({
  permissions,
  children,
}: {
  permissions: AdminPermission[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  const visibleGroups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.permission === undefined || allowed.has(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const activeItem = visibleGroups
    .flatMap((group) => group.items)
    .find((item) => isActiveRoute(pathname, item.href));

  return (
    <div className="admin-console">
      <aside className="admin-console-sidebar">
        <div className="admin-console-brand">
          <span className="admin-console-brand-mark" aria-hidden="true">
            A
          </span>

          <div>
            <Link href="/admin">Arena Core</Link>
            <small>مرکز عملیات</small>
          </div>
        </div>

        <nav className="admin-console-navigation" aria-label="ناوبری مدیریت">
          {visibleGroups.map((group) => (
            <section className="admin-console-nav-group" key={group.label}>
              <h2>{group.label}</h2>

              <div>
                {group.items.map((item) => {
                  const active = isActiveRoute(pathname, item.href);

                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'is-active' : undefined}
                      href={item.href}
                      key={item.href}
                    >
                      <span className="admin-console-nav-symbol" aria-hidden="true">
                        {item.symbol}
                      </span>

                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="admin-console-sidebar-footer">
          <span className="admin-console-security-dot" aria-hidden="true" />
          <span>دسترسی‌ها توسط سرور کنترل می‌شوند</span>
          <Link href="/dashboard">بازگشت به برنامه</Link>
        </div>
      </aside>

      <div className="admin-console-main">
        <header className="admin-console-topbar">
          <div>
            <span className="admin-console-eyebrow">Arena Operations</span>
            <strong>{activeItem?.label ?? 'مدیریت'}</strong>
          </div>

          <div className="admin-console-topbar-actions">
            <ThemeToggle />
            <span className="admin-console-environment">
              <span aria-hidden="true" />
              Production
            </span>

            <Link className="button secondary" href="/admin/search">
              جستجوی سریع
            </Link>
          </div>
        </header>

        <main id="main-content" className="admin-console-content">
          {children}
        </main>
      </div>
    </div>
  );
}
