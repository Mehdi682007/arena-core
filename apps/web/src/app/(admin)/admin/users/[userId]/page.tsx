import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Card } from '@/components/ui';
import { getAdminAccess, requireAdminPermission } from '@/features/admin/access';
import { adminApi } from '@/features/admin/api';
import { UserAccessActions } from '@/features/admin/user-access-actions';
import {
  ADMIN_PREVIEW_USER_ID,
  ADMIN_USER_PREVIEW_DETAIL,
  ADMIN_USER_PREVIEW_ROLES,
} from '@/features/admin/user-access-preview';
import type {
  AdminRoleListResponse,
  AdminUserDetail,
  AdminUserStatus,
} from '@/features/admin/user-access-types';
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
        timeStyle: 'medium',
      }).format(new Date(value));

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdminPermission('users.read');

  const { userId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    notFound();
  }

  const preview = isAdminUiPreviewEnabled();
  const access = await getAdminAccess();

  const permissions = access.status === 'allowed' ? access.permissions : [];

  let user: AdminUserDetail;
  let roles: AdminRoleListResponse;

  if (preview) {
    if (userId !== ADMIN_PREVIEW_USER_ID) {
      notFound();
    }

    user = ADMIN_USER_PREVIEW_DETAIL;
    roles = ADMIN_USER_PREVIEW_ROLES;
  } else {
    try {
      [user, roles] = await Promise.all([
        adminApi.resource<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`),
        permissions.includes('roles.read')
          ? adminApi.resource<AdminRoleListResponse>('/admin/roles')
          : Promise.resolve({ items: [] }),
      ]);
    } catch {
      return <Alert error>دریافت اطلاعات کاربر از API ممکن نشد.</Alert>;
    }
  }

  return (
    <div className="stack">
      <div className="admin-page-heading">
        <div>
          <Link href="/admin/users">بازگشت به کاربران</Link>
          <h1>{user.displayName ?? 'جزئیات کاربر'}</h1>
          <p className="ltr">{user.id}</p>
        </div>

        <span className={`admin-user-status admin-user-status-${user.status.toLowerCase()}`}>
          {statusLabels[user.status]}
        </span>
      </div>

      {preview ? <Alert>عملیات این صفحه در Preview فقط شبیه‌سازی می‌شوند.</Alert> : null}

      <section className="admin-user-metric-grid">
        <Card>
          <span>نشست‌ها</span>
          <strong>{user.counts.sessions}</strong>
        </Card>
        <Card>
          <span>حساب‌های بازی</span>
          <strong>{user.counts.gameAccounts}</strong>
        </Card>
        <Card>
          <span>مسابقه‌ها</span>
          <strong>{user.counts.matchParticipants}</strong>
        </Card>
        <Card>
          <span>اعلان‌ها</span>
          <strong>{user.counts.notifications}</strong>
        </Card>
      </section>

      <section className="admin-user-detail-grid">
        <Card>
          <h2>مشخصات حساب</h2>
          <dl className="admin-details">
            <dt>ایمیل</dt>
            <dd>{user.email ?? '—'}</dd>

            <dt>تأیید ایمیل</dt>
            <dd>{date(user.emailVerifiedAt)}</dd>

            <dt>کشور</dt>
            <dd>{user.countryCode ?? '—'}</dd>

            <dt>منطقه زمانی</dt>
            <dd>{user.timezone ?? '—'}</dd>

            <dt>تاریخ عضویت</dt>
            <dd>{date(user.createdAt)}</dd>

            <dt>آخرین ورود</dt>
            <dd>{date(user.lastAuthenticatedAt)}</dd>
          </dl>
        </Card>

        <Card>
          <h2>محدودیت حساب</h2>
          <dl className="admin-details">
            <dt>آخرین تغییر وضعیت</dt>
            <dd>{date(user.statusChangedAt)}</dd>

            <dt>پایان تعلیق</dt>
            <dd>{date(user.suspendedUntil)}</dd>

            <dt>کد دلیل</dt>
            <dd>{user.restrictionReasonCode ?? '—'}</dd>

            <dt>توضیح</dt>
            <dd>{user.restrictionNote ?? '—'}</dd>
          </dl>
        </Card>
      </section>

      <Card>
        <UserAccessActions
          user={user}
          availableRoles={roles.items}
          permissions={permissions}
          preview={preview}
        />
      </Card>

      <section className="admin-user-detail-grid">
        <Card>
          <div className="admin-section-heading">
            <h2>نقش‌ها</h2>
            <span>{user.roles.length}</span>
          </div>

          {user.roles.length === 0 ? (
            <p className="muted">نقشی برای این کاربر ثبت نشده است.</p>
          ) : (
            <div className="admin-user-role-list">
              {user.roles.map((role) => (
                <article key={role.id}>
                  <div>
                    <strong>{role.name}</strong>
                    <code>{role.key}</code>
                  </div>
                  <span>{role.isSystem ? 'نقش سیستمی' : 'نقش سفارشی'}</span>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="admin-section-heading">
            <h2>دسترسی‌های مؤثر</h2>
            <span>{user.effectivePermissions.length}</span>
          </div>

          <div className="admin-permission-cloud">
            {user.effectivePermissions.map((permission) => (
              <code key={permission}>{permission}</code>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="admin-section-heading">
          <h2>نشست‌های اخیر</h2>
          <span>{user.sessions.length}</span>
        </div>

        <div className="admin-session-list">
          {user.sessions.map((session) => (
            <article key={session.id}>
              <div>
                <strong>{session.userAgent ?? 'دستگاه ناشناس'}</strong>
                <span className="ltr">{session.id}</span>
              </div>

              <div>
                <span>{session.status}</span>
                <time dateTime={session.createdAt}>ایجاد: {date(session.createdAt)}</time>
                <time dateTime={session.lastSeenAt ?? undefined}>
                  آخرین فعالیت: {date(session.lastSeenAt)}
                </time>
              </div>
            </article>
          ))}
        </div>
      </Card>

      {permissions.includes('timeline.read') ? (
        <Link
          className="button secondary"
          href={`/admin/users/${encodeURIComponent(user.id)}/timeline`}
        >
          مشاهده خط زمانی کامل
        </Link>
      ) : null}
    </div>
  );
}
