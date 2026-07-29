import Link from 'next/link';
import { Alert, Card, EmptyState } from '@/components/ui';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';
export default async function DashboardPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const [ratings, notifications] = await Promise.all([
    serverApi<
      readonly {
        game: { name: string };
        mode: { name: string };
        rating: number;
        rank: number | null;
      }[]
    >('/ratings').catch(() => []),
    serverApi<{ items: readonly { id: string; subject: string }[] }>(
      '/notifications?limit=3&unread=true',
    ).catch(() => ({ items: [] })),
  ]);
  return (
    <div className="stack">
      <h1>سلام، {session.user.displayName}</h1>
      {!session.user.emailVerified ? (
        <Alert error>
          ایمیل شما هنوز تأیید نشده است. <Link href="/verify-email">تأیید ایمیل</Link>
        </Alert>
      ) : null}
      {!session.user.onboardingCompleted ? (
        <Alert>پروفایل خود را برای تکمیل شروع کار به‌روز کنید.</Alert>
      ) : null}
      <div className="grid">
        <Card>
          <h2>رتبه شما</h2>
          {ratings[0] ? (
            <p>
              {ratings[0].game.name} — {ratings[0].mode.name}:{' '}
              {new Intl.NumberFormat('fa').format(ratings[0].rating)}
            </p>
          ) : (
            <p className="muted">هنوز رتبه‌ای ثبت نشده است.</p>
          )}
        </Card>
        <Card>
          <h2>اعلان‌های تازه</h2>
          {notifications.items.length ? (
            <ul>
              {notifications.items.map((item) => (
                <li key={item.id}>{item.subject}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">اعلان تازه‌ای ندارید.</p>
          )}
        </Card>
      </div>
      <EmptyState title="اقدام‌های سریع">
        <Link className="button secondary" href="/profile">
          تکمیل پروفایل
        </Link>
      </EmptyState>
    </div>
  );
}
