import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/shells';
import { ErrorState } from '@/components/ui';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export const dynamic = 'force-dynamic';
export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.status === 'unauthenticated') redirect('/login');
  if (session.status === 'unavailable')
    return (
      <main className="container page">
        <ErrorState requestId={session.requestId} />
      </main>
    );
  const unread = await serverApi<{ count: number }>('/notifications/unread-count').catch(() => ({
    count: 0,
  }));
  return (
    <AppShell user={session.user} unreadCount={unread.count}>
      {children}
    </AppShell>
  );
}
