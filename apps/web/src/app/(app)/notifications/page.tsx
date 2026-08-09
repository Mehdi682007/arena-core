import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import {
  NotificationList,
  type NotificationItem,
} from '@/features/notifications/notification-list';
import { serverApi } from '@/lib/api/server-api-client';
export default async function NotificationsPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const page = await serverApi<{ items: NotificationItem[]; nextCursor: string | null }>(
    '/notifications?limit=20',
  );
  return (
    <div className="stack">
      <h1>{ui.notifications}</h1>
      <NotificationList initialItems={page.items} nextCursor={page.nextCursor} />
    </div>
  );
}
