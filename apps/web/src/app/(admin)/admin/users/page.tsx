import Link from 'next/link';
import { Alert, Field, Input, Select } from '@/components/ui';
import { requireAdminPermission } from '@/features/admin/access';
import { adminApi } from '@/features/admin/api';
import { AdminTable } from '@/features/admin/components';
import { ADMIN_USER_PREVIEW_LIST } from '@/features/admin/user-access-preview';
import type { AdminUserListResponse, AdminUserStatus } from '@/features/admin/user-access-types';
import { isAdminUiPreviewEnabled } from '@/features/admin/preview';
import type { AppLocale } from '@/i18n/config';
import { getRequestLocale } from '@/i18n/server';
import { uiMessagesFor } from '@/i18n/ui-messages';

const statusLabelsFor = (locale: AppLocale): Record<AdminUserStatus, string> => {
  const ui = uiMessagesFor(locale);
  return {
    PENDING_VERIFICATION: ui.pendingVerification,
    ACTIVE: ui.active,
    SUSPENDED: ui.suspended,
    BANNED: ui.blocked,
    DISABLED: ui.inactive,
    DELETED: ui.deleted,
  };
};

const date = (value: string | null, locale: AppLocale) =>
  value === null
    ? '—'
    : new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const statusLabels = statusLabelsFor(locale);
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
          <h1>{ui.userManagement}</h1>
          <p>{ui.searchCheckStatusAndPerformManualOperations}</p>
        </div>

        <span className="admin-result-count">
          {new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(result.items.length)}{' '}
          {ui.theResult}
        </span>
      </div>

      {preview ? <Alert>{ui.theDataOnThisPageIsIn}</Alert> : null}

      {unavailable ? <Alert error>{ui.failedToGetUserListFromApi}</Alert> : null}

      <form className="admin-filter" method="get">
        <Field name="term" label={ui.search}>
          <Input
            id="term"
            name="term"
            defaultValue={term}
            minLength={2}
            maxLength={128}
            placeholder={ui.emailDisplayNameOrUuid}
          />
        </Field>

        <Field name="status" label={ui.status}>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">{ui.allSituations}</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <button className="button">{ui.applyFilter}</button>

        <Link className="button secondary" href="/admin/users">
          {ui.erase}
        </Link>
      </form>

      <AdminTable
        caption={ui.listOfUsers}
        headings={[ui.user, ui.status, ui.country, ui.lastEntry, ui.dateOfMembership, ui.action]}
        rows={result.items.map((user) => [
          <div className="admin-user-identity" key="identity">
            <strong>{user.displayName ?? ui.noScreenName}</strong>
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
            {date(user.lastAuthenticatedAt, locale)}
          </time>,
          <time key="created" dateTime={user.createdAt}>
            {date(user.createdAt, locale)}
          </time>,
          <Link key="detail" href={`/admin/users/${encodeURIComponent(user.id)}`}>
            {ui.viewAndManage}
          </Link>,
        ])}
      />
    </div>
  );
}
