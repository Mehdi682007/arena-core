import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { redactAdminValue, safeAdminHref } from './privacy';
import type { AdminPermission, OutboxItem, TimelineItem } from './types';

const faDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'زمان نامعتبر'
    : new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
};
export function AdminShell({
  permissions,
  children,
}: {
  permissions: AdminPermission[];
  children: ReactNode;
}) {
  const allowed = new Set(permissions);
  const links = [
    ['/admin', 'نمای کلی', true],
    ['/admin/search', 'جستجو', allowed.has('support.read')],
    ['/admin/audit', 'رویدادهای ممیزی', allowed.has('audit.read')],
    ['/admin/notifications', 'اعلان‌ها', allowed.has('notifications.read')],
    ['/admin/diagnostics', 'وضعیت سرویس', allowed.has('diagnostics.read')],
    ['/admin/support', 'عملیات پشتیبانی', allowed.has('support.manage')],
  ] as const;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          مدیریت Arena Core
        </Link>
        <nav aria-label="ناوبری مدیریت" className="stack">
          {links
            .filter((item) => item[2])
            .map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          <Link href="/dashboard">بازگشت به برنامه</Link>
        </nav>
      </aside>
      <main id="main-content" className="admin-content">
        {children}
      </main>
    </div>
  );
}
export function AdminTable({
  caption,
  headings,
  rows,
}: {
  caption: string;
  headings: string[];
  rows: ReactNode[][];
}) {
  if (!rows.length) return <EmptyState title="موردی یافت نشد" />;
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
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <EmptyState title="رویدادی در این Timeline وجود ندارد" />;
  return (
    <ol className="admin-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <div className="cluster">
              <Badge>{item.type}</Badge>
              <time dateTime={item.occurredAt}>{faDate(item.occurredAt)}</time>
            </div>
            <p>{item.summary}</p>
            <SafeJson value={item.data} />
          </Card>
        </li>
      ))}
    </ol>
  );
}
export function OutboxTable({ items }: { items: OutboxItem[] }) {
  return (
    <AdminTable
      caption="پیام‌های Outbox"
      headings={['نوع', 'کانال', 'وضعیت', 'تلاش', 'زمان دسترسی', 'جزئیات']}
      rows={items.map((item) => [
        item.type,
        item.channel,
        <Badge key="status">{item.status}</Badge>,
        new Intl.NumberFormat('fa').format(item.attemptCount),
        <time key="time" dateTime={item.availableAt}>
          {faDate(item.availableAt)}
        </time>,
        <Link key="link" href={safeAdminHref('outbox', item.id) ?? '/admin/notifications'}>
          مشاهده
        </Link>,
      ])}
    />
  );
}
export function CursorNext({ href, cursor }: { href: string; cursor: string | null }) {
  return cursor ? (
    <Link
      className="button secondary"
      href={`${href}${href.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`}
    >
      صفحه بعد
    </Link>
  ) : null;
}
