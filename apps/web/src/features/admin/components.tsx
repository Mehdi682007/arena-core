import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { redactAdminValue, safeAdminHref } from './privacy';
import type { AdminPermission, OutboxItem, TimelineItem } from './types';
import type { AppLocale } from '@/i18n/config';
import { presentAction, presentChannel, presentStatus } from '@/i18n/presentation';
import { notificationPresentation } from '@/features/notifications/notification-presentation';

const localizedDate = (value: string, locale: AppLocale, invalidTime: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? invalidTime
    : new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(date);
};
export async function AdminShell({
  permissions,
  children,
}: {
  permissions: AdminPermission[];
  children: ReactNode;
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const allowed = new Set(permissions);
  const links = [
    ['/admin', ui.overview, true],
    ['/admin/search', ui.search, allowed.has('support.read')],
    ['/admin/audit', ui.auditEvents, allowed.has('audit.read')],
    ['/admin/notifications', ui.notifications, allowed.has('notifications.read')],
    ['/admin/diagnostics', ui.serviceStatus, allowed.has('diagnostics.read')],
    ['/admin/support', ui.supportOperations, allowed.has('support.manage')],
    ['/admin/game-accounts', ui.reviewGameAccounts, allowed.has('game_accounts.read')],
    ['/admin/matches', ui.competitions, allowed.has('matches.read')],
    ['/admin/results', ui.resultConflicts, allowed.has('match_results.read')],
    ['/admin/disputes', ui.disputes, allowed.has('match_disputes.read')],
    ['/admin/matchmaking', ui.matchmaking2, allowed.has('matchmaking.read')],
    ['/admin/wallets', ui.walletAndLedger, allowed.has('wallets.read')],
    ['/admin/finance', ui.matchFinance, allowed.has('match_finance.read')],
    ['/admin/settlements', ui.settlements, allowed.has('match_settlements.read')],
    ['/admin/ratings', ui.ratings, allowed.has('ratings.read')],
  ] as const;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          {ui.arenaCoreManagement}
        </Link>
        <nav aria-label={ui.managementNavigation} className="stack">
          {links
            .filter((item) => item[2])
            .map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          <Link href="/dashboard">{ui.backToTheProgram}</Link>
        </nav>
      </aside>
      <main id="main-content" className="admin-content">
        {children}
      </main>
    </div>
  );
}
export async function AdminTable({
  caption,
  headings,
  rows,
}: {
  caption: string;
  headings: string[];
  rows: ReactNode[][];
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  if (!rows.length) return <EmptyState title={ui.noItemsFound} />;
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SafeJson({ value }: { value: unknown }) {
  return <pre className="admin-json ltr">{JSON.stringify(redactAdminValue(value), null, 2)}</pre>;
}
export async function Timeline({ items }: { items: TimelineItem[] }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  if (!items.length) return <EmptyState title={ui.thereAreNoEventsInThisTimeline} />;
  return (
    <ol className="admin-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <div className="cluster">
              <Badge>{presentAction(item.type, locale)}</Badge>
              <time dateTime={item.occurredAt}>
                {localizedDate(item.occurredAt, locale, ui.invalidTime)}
              </time>
            </div>
            <p>{item.summary}</p>
            <SafeJson value={item.data} />
          </Card>
        </li>
      ))}
    </ol>
  );
}
export async function OutboxTable({ items }: { items: OutboxItem[] }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  return (
    <AdminTable
      caption={ui.outboxMessages}
      headings={[ui.type, ui.channel, ui.status, ui.effort, ui.accessTime, ui.details]}
      rows={items.map((item) => [
        notificationPresentation(item.type, locale).title,
        presentChannel(item.channel, locale),
        <Badge key="status">{presentStatus(item.status, locale)}</Badge>,
        new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(item.attemptCount),
        <time key="time" dateTime={item.availableAt}>
          {localizedDate(item.availableAt, locale, ui.invalidTime)}
        </time>,
        <Link key="link" href={safeAdminHref('outbox', item.id) ?? '/admin/notifications'}>
          {ui.view}
        </Link>,
      ])}
    />
  );
}
export async function CursorNext({ href, cursor }: { href: string; cursor: string | null }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  return cursor ? (
    <Link
      className="button secondary"
      href={`${href}${href.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`}
    >
      {ui.nextPage}
    </Link>
  ) : null;
}
