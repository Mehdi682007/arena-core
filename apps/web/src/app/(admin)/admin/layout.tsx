import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { ErrorState } from '@/components/ui';
import { AdminShell } from '@/features/admin/components';
import { getAdminAccess } from '@/features/admin/access';
import { getSession } from '@/features/session/session';

export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.status === 'unauthenticated') redirect('/login?returnTo=%2Fadmin');
  if (session.status === 'unavailable')
    return (
      <main className="container page">
        <ErrorState requestId={session.requestId} />
      </main>
    );
  const access = await getAdminAccess();
  if (access.status === 'forbidden') redirect('/dashboard?admin=forbidden');
  if (access.status === 'unavailable')
    return (
      <main className="container page">
        <ErrorState requestId={access.requestId} />
      </main>
    );
  return <AdminShell permissions={access.permissions}>{children}</AdminShell>;
}
