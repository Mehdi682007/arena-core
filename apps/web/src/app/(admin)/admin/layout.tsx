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

  if (access.status === 'forbidden') {
    redirect('/dashboard?admin=forbidden');
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
