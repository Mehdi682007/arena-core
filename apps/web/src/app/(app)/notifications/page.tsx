import { getSession } from '@/features/session/session';
import {
  NotificationList,
  type NotificationItem,
} from '@/features/notifications/notification-list';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function NotificationsPage() {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = productMessagesFor(locale).notifications;
  const page = await serverApi<{ items: NotificationItem[]; nextCursor: string | null }>(
    '/notifications?limit=20',
  );
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      <NotificationList initialItems={page.items} nextCursor={page.nextCursor} locale={locale} />
    </div>
  );
}
