import Link from 'next/link';
import { Alert } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';
import { adminApi } from '@/features/admin/api';
import { ADMIN_PREVIEW_PERMISSIONS, isAdminUiPreviewEnabled } from '@/features/admin/preview';
import type { AdminPermission, Diagnostics } from '@/features/admin/types';

type DashboardLink = {
  permission: AdminPermission;
  href: string;
  title: string;
  description: string;
  symbol: string;
};

const shortcuts: readonly DashboardLink[] = [
  {
    permission: 'match_disputes.read',
    href: '/admin/disputes',
    title: 'صف اختلاف‌ها',
    description: 'مواردی که به بررسی انسانی و تصمیم عملیاتی نیاز دارند.',
    symbol: '⚖',
  },
  {
    permission: 'match_results.read',
    href: '/admin/results',
    title: 'تعارض نتیجه‌ها',
    description: 'ارسال‌های ناسازگار و شواهد مربوط به مسابقه‌ها.',
    symbol: '≠',
  },
  {
    permission: 'notifications.read',
    href: '/admin/notifications/outbox',
    title: 'صف اعلان‌ها',
    description: 'وضعیت تحویل، تلاش مجدد و پیام‌های متوقف‌شده.',
    symbol: '✦',
  },
  {
    permission: 'audit.read',
    href: '/admin/audit',
    title: 'ممیزی عملیات',
    description: 'ردپای تغییرات حساس و عملیات ثبت‌شده مدیران.',
    symbol: '≣',
  },
  {
    permission: 'matches.read',
    href: '/admin/matches',
    title: 'مسابقه‌ها',
    description: 'وضعیت مسابقات، شرکت‌کنندگان و Timeline عملیاتی.',
    symbol: '⚔',
  },
  {
    permission: 'wallets.read',
    href: '/admin/wallets',
    title: 'کیف پول',
    description: 'نمای عملیاتی موجودی‌ها و دفترکل مالی کاربران.',
    symbol: '◈',
  },
];

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const formatter = new Intl.NumberFormat('fa');

  if (days > 0) {
    return `${formatter.format(days)} روز`;
  }

  if (hours > 0) {
    return `${formatter.format(hours)} ساعت`;
  }

  return `${formatter.format(minutes)} دقیقه`;
};

async function loadDiagnostics(permissions: Set<AdminPermission>): Promise<Diagnostics | null> {
  if (!permissions.has('diagnostics.read')) {
    return null;
  }

  try {
    return await adminApi.diagnostics();
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const preview = isAdminUiPreviewEnabled();
  const access = preview ? null : await getAdminAccess();

  if (!preview && access?.status !== 'allowed') {
    return <Alert error>قابلیت‌های مدیریت در دسترس نیست.</Alert>;
  }

  const permissions =
    access?.status === 'allowed' ? access.permissions : [...ADMIN_PREVIEW_PERMISSIONS];

  const allowed = new Set(permissions);
  const diagnostics = preview ? null : await loadDiagnostics(allowed);

  const dependencyEntries = diagnostics ? Object.entries(diagnostics.dependencies) : [];

  const healthyDependencies = dependencyEntries.filter(
    ([, status]) =>
      status === 'up' || status === 'ok' || status === 'configured' || status === 'disabled',
  ).length;

  return (
    <div className="admin-dashboard stack">
      {preview ? (
        <Alert>
          حالت پیش‌نمایش رابط مدیریت فعال است؛ داده‌های زنده API در این محیط بارگذاری نمی‌شوند.
        </Alert>
      ) : null}

      <section className="admin-dashboard-hero">
        <div>
          <span className="admin-console-eyebrow">Operational command center</span>

          <h1>مرکز عملیات Arena Core</h1>

          <p>
            نمای متمرکز برای پایش سرویس، رسیدگی به صف‌های عملیاتی و دسترسی سریع به ابزارهای مدیریتی
            مجوزسنجی‌شده.
          </p>
        </div>

        <div className="admin-dashboard-hero-status">
          <span aria-hidden="true" />

          <div>
            <strong>
              {preview
                ? 'حالت پیش‌نمایش توسعه'
                : diagnostics?.shuttingDown
                  ? 'سرویس در حال توقف است'
                  : diagnostics
                    ? 'سرویس فعال است'
                    : 'وضعیت سرویس در دسترس نیست'}
            </strong>

            <small>
              {preview
                ? 'API محلی متصل نیست'
                : diagnostics
                  ? `${diagnostics.service} · ${diagnostics.environment}`
                  : 'اطلاعات Diagnostics دریافت نشد'}
            </small>
          </div>
        </div>
      </section>

      <section className="admin-metric-grid" aria-label="شاخص‌های عملیاتی">
        <article className="admin-metric-card">
          <span>دسترسی‌های فعال</span>

          <strong>{new Intl.NumberFormat('fa').format(permissions.length)}</strong>

          <small>قابلیت مجاز برای حساب فعلی</small>
        </article>

        <article className="admin-metric-card">
          <span>سلامت وابستگی‌ها</span>

          <strong>
            {diagnostics
              ? `${new Intl.NumberFormat('fa').format(
                  healthyDependencies,
                )} / ${new Intl.NumberFormat('fa').format(dependencyEntries.length)}`
              : '—'}
          </strong>

          <small>بر اساس Diagnostics سرویس API</small>
        </article>

        <article className="admin-metric-card">
          <span>زمان فعالیت API</span>

          <strong>{diagnostics ? formatUptime(diagnostics.uptimeSeconds) : '—'}</strong>

          <small>از آخرین راه‌اندازی سرویس</small>
        </article>

        <article className="admin-metric-card">
          <span>نسخه عملیاتی</span>

          <strong className="ltr admin-metric-version">{diagnostics?.version ?? 'Preview'}</strong>

          <small className="ltr">
            {diagnostics?.buildSha ? diagnostics.buildSha.slice(0, 12) : 'Live build unavailable'}
          </small>
        </article>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-section-heading">
          <div>
            <span className="admin-console-eyebrow">Quick access</span>
            <h2>صف‌ها و ابزارهای اصلی</h2>
          </div>

          <Link href="/admin/search">جستجوی پیشرفته</Link>
        </div>

        <div className="admin-shortcut-grid">
          {shortcuts
            .filter((item) => allowed.has(item.permission))
            .map((item) => (
              <Link className="admin-shortcut-card" href={item.href} key={item.href}>
                <span className="admin-shortcut-symbol" aria-hidden="true">
                  {item.symbol}
                </span>

                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>

                <span className="admin-shortcut-arrow" aria-hidden="true">
                  ←
                </span>
              </Link>
            ))}
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-dashboard-panel">
          <div className="admin-section-heading">
            <div>
              <span className="admin-console-eyebrow">Dependencies</span>

              <h2>وابستگی‌های سرویس</h2>
            </div>

            {allowed.has('diagnostics.read') ? <Link href="/admin/diagnostics">جزئیات</Link> : null}
          </div>

          {dependencyEntries.length > 0 ? (
            <dl className="admin-dependency-list">
              {dependencyEntries.map(([name, status]) => (
                <div key={name}>
                  <dt className="ltr">{name}</dt>

                  <dd>
                    <span className={`admin-status-chip admin-status-${status.toLowerCase()}`}>
                      {status}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">
              {preview
                ? 'داده زنده وابستگی‌ها در حالت پیش‌نمایش نمایش داده نمی‌شود.'
                : 'اطلاعات وابستگی‌ها در این لحظه در دسترس نیست.'}
            </p>
          )}
        </article>

        <article className="admin-dashboard-panel admin-security-panel">
          <div>
            <span className="admin-console-eyebrow">Security boundary</span>

            <h2>کنترل عملیات حساس</h2>
          </div>

          <ul>
            <li>تمام عملیات حساس دوباره در Backend مجوزسنجی می‌شوند.</li>

            <li>عملیات تغییر‌دهنده با ثبت ممیزی و تأیید صریح اجرا می‌شوند.</li>

            <li>حالت Preview فقط در محیط غیر Production و با فلگ صریح فعال می‌شود.</li>
          </ul>

          {allowed.has('audit.read') ? (
            <Link className="button secondary" href="/admin/audit">
              مشاهده رویدادهای ممیزی
            </Link>
          ) : null}
        </article>
      </section>
    </div>
  );
}
