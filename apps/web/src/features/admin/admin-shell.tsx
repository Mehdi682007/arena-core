'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { adminDictionaries, type AdminItemKey } from '@/i18n/admin-dictionary';
import type { AppLocale } from '@/i18n/config';
import { AdminNavIcon } from './admin-nav-icon';
import { ThemeToggle } from './theme-toggle';
import type { AdminPermission } from './types';

type AdminNavigationItem = {
  key: AdminItemKey;
  href: string;
  permission?: AdminPermission;
};

type AdminNavigationGroup = {
  key: string;
  items: readonly AdminNavigationItem[];
};

const navigation: readonly AdminNavigationGroup[] = [
  {
    key: 'operations',
    items: [
      { key: 'overview', href: '/admin' },
      {
        key: 'search',
        href: '/admin/search',
        permission: 'support.read',
      },
      {
        key: 'users',
        href: '/admin/users',
        permission: 'users.read',
      },
      {
        key: 'diagnostics',
        href: '/admin/diagnostics',
        permission: 'diagnostics.read',
      },
      {
        key: 'audit',
        href: '/admin/audit',
        permission: 'audit.read',
      },
    ],
  },
  {
    key: 'competition',
    items: [
      {
        key: 'gameAccounts',
        href: '/admin/game-accounts',
        permission: 'game_accounts.read',
      },
      {
        key: 'matches',
        href: '/admin/matches',
        permission: 'matches.read',
      },
      {
        key: 'results',
        href: '/admin/results',
        permission: 'match_results.read',
      },
      {
        key: 'disputes',
        href: '/admin/disputes',
        permission: 'match_disputes.read',
      },
      {
        key: 'matchmaking',
        href: '/admin/matchmaking',
        permission: 'matchmaking.read',
      },
      {
        key: 'ratings',
        href: '/admin/ratings',
        permission: 'ratings.read',
      },
    ],
  },
  {
    key: 'finance',
    items: [
      {
        key: 'wallets',
        href: '/admin/wallets',
        permission: 'wallets.read',
      },
      {
        key: 'finance',
        href: '/admin/finance',
        permission: 'match_finance.read',
      },
      {
        key: 'settlements',
        href: '/admin/settlements',
        permission: 'match_settlements.read',
      },
    ],
  },
  {
    key: 'communications',
    items: [
      {
        key: 'notifications',
        href: '/admin/notifications',
        permission: 'notifications.read',
      },
      {
        key: 'support',
        href: '/admin/support',
        permission: 'support.manage',
      },
      {
        key: 'siteSettings',
        href: '/admin/settings/site',
        permission: 'site_settings.read',
      },
    ],
  },
];

const isActiveRoute = (pathname: string, href: string) =>
  href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function AdminOperationsShell({
  locale,
  permissions,
  children,
}: {
  locale: AppLocale;
  permissions: AdminPermission[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const dictionary = adminDictionaries[locale];
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleGroups = useMemo(() => {
    const allowed = new Set(permissions);

    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item.permission === undefined || allowed.has(item.permission),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [permissions]);

  const activeItem = visibleGroups
    .flatMap((group) => group.items)
    .find((item) => isActiveRoute(pathname, item.href));

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="admin-console">
      <button
        aria-label={dictionary.closeMenu}
        className={`admin-console-backdrop${menuOpen ? ' is-visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-hidden={!menuOpen ? undefined : false}
        className={`admin-console-sidebar${menuOpen ? ' is-open' : ''}`}
      >
        <div className="admin-console-brand">
          <span className="admin-console-brand-mark" aria-hidden="true">
            A
          </span>

          <div>
            <Link href="/admin">Arena Core</Link>
            <small>{dictionary.operationsCenter}</small>
          </div>

          <button
            aria-label={dictionary.closeMenu}
            className="admin-console-sidebar-close"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav className="admin-console-navigation" aria-label={dictionary.adminNavigation}>
          {visibleGroups.map((group) => (
            <section className="admin-console-nav-group" key={group.key}>
              <h2>{dictionary.groups[group.key]?.label ?? dictionary.administration}</h2>

              <div>
                {group.items.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const text = dictionary.items[item.key];

                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'is-active' : undefined}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="admin-console-nav-symbol" aria-hidden="true">
                        <AdminNavIcon href={item.href} />
                      </span>

                      <span>
                        <strong>{text.label}</strong>
                        <small>{text.description}</small>
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
          <span>{dictionary.securityControlled}</span>
          <Link href="/dashboard">{dictionary.backToApplication}</Link>
        </div>
      </aside>

      <div className="admin-console-main">
        <header className="admin-console-topbar">
          <div className="admin-console-topbar-title">
            <button
              aria-expanded={menuOpen}
              aria-label={dictionary.openMenu}
              className="admin-console-menu-toggle"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" />
            </button>

            <div>
              <span className="admin-console-eyebrow">Arena Operations</span>
              <strong>
                {activeItem ? dictionary.items[activeItem.key].label : dictionary.administration}
              </strong>
            </div>
          </div>

          <div className="admin-console-topbar-actions">
            <LanguageToggle compact initialLocale={locale} />
            <ThemeToggle locale={locale} />

            <span className="admin-console-environment">
              <span aria-hidden="true" />
              {dictionary.production}
            </span>

            <Link className="button secondary admin-console-quick-search" href="/admin/search">
              {dictionary.quickSearch}
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
