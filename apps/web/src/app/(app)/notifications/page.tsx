import {
  NotificationList,
  type NotificationItem,
} from '@/features/notifications/notification-list';
import { serverApi } from '@/lib/api/server-api-client';
export default async function NotificationsPage() {
  const page = await serverApi<{ items: NotificationItem[]; nextCursor: string | null }>(
    '/notifications?limit=20',
  );
  return (
    <div className="stack">
      <h1>اعلان‌ها</h1>
      <NotificationList initialItems={page.items} nextCursor={page.nextCursor} />
    </div>
  );
}
