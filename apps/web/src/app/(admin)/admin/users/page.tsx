import Link from 'next/link';
import { Alert, Field, Input, Select } from '@/components/ui';
import { requireAdminPermission } from '@/features/admin/access';
import { adminApi } from '@/features/admin/api';
import { AdminTable } from '@/features/admin/components';
import { ADMIN_USER_PREVIEW_LIST } from '@/features/admin/user-access-preview';
import type { AdminUserListResponse, AdminUserStatus } from '@/features/admin/user-access-types';
import { isAdminUiPreviewEnabled } from '@/features/admin/preview';

const statusLabels: Record<AdminUserStatus, string> = {
  PENDING_VERIFICATION: 'در انتظار تأیید',
  ACTIVE: 'فعال',
  SUSPENDED: 'معلق',
  BANNED: 'مسدود',
  DISABLED: 'غیرفعال',
  DELETED: 'حذف‌شده',
};

const date = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.DateTimeFormat('fa', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission('users.read');

  const params = await searchParams;
  const term = typeof params.term === 'string' ? params.term.slice(0, 128) : '';

  const status = typeof params.status === 'string' ? params.status : '';

  const query = new URLSearchParams({
    limit: '50',
  });

  if (term.length >= 2) {
    query.set('term', term);
  }

  if (status.length > 0) {
    query.set('status', status);
  }

  const preview = isAdminUiPreviewEnabled();
  let result: AdminUserListResponse;
  let unavailable = false;

  if (preview) {
    result = ADMIN_USER_PREVIEW_LIST;
  } else {
    try {
      result = await adminApi.resource<AdminUserListResponse>(`/admin/users?${query.toString()}`);
    } catch {
      result = { items: [] };
      unavailable = true;
    }
  }

  return (
    <div className="stack">
      <div className="admin-page-heading">
        <div>
          <span className="admin-console-eyebrow">Identity operations</span>
          <h1>مدیریت کاربران</h1>
          <p>جستجو، بررسی وضعیت و اجرای عملیات دستی روی حساب‌ها</p>
        </div>

        <span className="admin-result-count">
          {new Intl.NumberFormat('fa').format(result.items.length)} نتیجه
        </span>
      </div>

      {preview ? <Alert>داده‌های این صفحه در حالت پیش‌نمایش نمونه هستند.</Alert> : null}

      {unavailable ? <Alert error>دریافت فهرست کاربران از API ممکن نشد.</Alert> : null}

      <form className="admin-filter" method="get">
        <Field name="term" label="جستجو">
          <Input
            id="term"
            name="term"
            defaultValue={term}
            minLength={2}
            maxLength={128}
            placeholder="ایمیل، نام نمایشی یا UUID"
          />
        </Field>

        <Field name="status" label="وضعیت">
          <Select id="status" name="status" defaultValue={status}>
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <button className="button">اعمال فیلتر</button>

        <Link className="button secondary" href="/admin/users">
          پاک‌کردن
        </Link>
      </form>

      <AdminTable
        caption="فهرست کاربران"
        headings={['کاربر', 'وضعیت', 'کشور', 'آخرین ورود', 'تاریخ عضویت', 'عملیات']}
        rows={result.items.map((user) => [
          <div className="admin-user-identity" key="identity">
            <strong>{user.displayName ?? 'بدون نام نمایشی'}</strong>
            <span>{user.email ?? user.id}</span>
          </div>,
          <span
            className={`admin-user-status admin-user-status-${user.status.toLowerCase()}`}
            key="status"
          >
            {statusLabels[user.status]}
          </span>,
          user.countryCode ?? '—',
          <time key="last" dateTime={user.lastAuthenticatedAt ?? undefined}>
            {date(user.lastAuthenticatedAt)}
          </time>,
          <time key="created" dateTime={user.createdAt}>
            {date(user.createdAt)}
          </time>,
          <Link key="detail" href={`/admin/users/${encodeURIComponent(user.id)}`}>
            مشاهده و مدیریت
          </Link>,
        ])}
      />
    </div>
  );
}
