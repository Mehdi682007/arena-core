import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';
import { AdminOperationsShell } from '@/features/admin/admin-shell';
import { ADMIN_PREVIEW_PERMISSIONS, isAdminUiPreviewEnabled } from '@/features/admin/preview';
import { getSession } from '@/features/session/session';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (isAdminUiPreviewEnabled()) {
    return (
      <AdminOperationsShell permissions={[...ADMIN_PREVIEW_PERMISSIONS]}>
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
        <Alert error>دریافت اطلاعات ممکن نشد.</Alert>
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
        <Alert error>دریافت اطلاعات ممکن نشد.</Alert>
      </main>
    );
  }

  return <AdminOperationsShell permissions={access.permissions}>{children}</AdminOperationsShell>;
}
