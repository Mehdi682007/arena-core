import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';
import { AdminOperationsShell } from '@/features/admin/admin-shell';
import { ADMIN_PREVIEW_PERMISSIONS, isAdminUiPreviewEnabled } from '@/features/admin/preview';
import { getSession } from '@/features/session/session';
import { localeCookieName, normalizeLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value);

  if (isAdminUiPreviewEnabled()) {
    return (
      <AdminOperationsShell locale={locale} permissions={[...ADMIN_PREVIEW_PERMISSIONS]}>
        {children}
      </AdminOperationsShell>
    );
  }

  const session = await getSession();

  if (session.status === 'unauthenticated') {
    redirect('/login?returnTo=%2Fadmin');
  }

  if (session.status !== 'authenticated') {
    return (
      <main className="container page">
        <Alert error>
          {locale === 'fa' ? 'دریافت اطلاعات ممکن نشد.' : 'Unable to load information.'}
        </Alert>
      </main>
    );
  }

  const access = await getAdminAccess();
  const publicBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

  if (access.status === 'mfa-required') {
    return (
      <main className="container page stack">
        <Alert error>
          {locale === 'fa'
            ? 'برای دسترسی به مدیریت، ابتدا احراز هویت دومرحله‌ای را فعال و تأیید کنید.'
            : 'Enable and verify two-factor authentication before accessing administration.'}
        </Alert>

        <a className="button" href={`${publicBaseUrl}/settings/security/mfa`}>
          {locale === 'fa' ? 'تنظیم احراز هویت دومرحله‌ای' : 'Set up two-factor authentication'}
        </a>
      </main>
    );
  }

  if (access.status === 'forbidden') {
    return (
      <main className="container page stack">
        <Alert error>
          {locale === 'fa'
            ? 'حساب شما اجازه دسترسی به بخش مدیریت را ندارد.'
            : 'Your account does not have permission to access administration.'}
        </Alert>

        <a className="button secondary" href={publicBaseUrl || '/'}>
          {locale === 'fa' ? 'بازگشت به برنامه' : 'Back to application'}
        </a>
      </main>
    );
  }

  if (access.status !== 'allowed') {
    return (
      <main className="container page">
        <Alert error>
          {locale === 'fa' ? 'دریافت اطلاعات ممکن نشد.' : 'Unable to load information.'}
        </Alert>
      </main>
    );
  }

  return (
    <AdminOperationsShell locale={locale} permissions={access.permissions}>
      {children}
    </AdminOperationsShell>
  );
}
