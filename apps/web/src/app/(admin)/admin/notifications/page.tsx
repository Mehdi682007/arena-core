import Link from 'next/link';
import { Card } from '@/components/ui';
import { requireAdminPermission } from '@/features/admin/access';
export default async function NotificationAdminPage() {
  await requireAdminPermission('notifications.read');
  return (
    <div className="stack">
      <h1>مدیریت اعلان‌ها</h1>
      <div className="grid">
        <Card>
          <h2>Outbox</h2>
          <Link href="/admin/notifications/outbox">مشاهده پیام‌ها</Link>
        </Card>
        <Card>
          <h2>Dead-letter</h2>
          <Link href="/admin/notifications/dead-letter">پیام‌های متوقف‌شده</Link>
        </Card>
        <Card>
          <h2>Recovery</h2>
          <Link href="/admin/support">عملیات بازیابی</Link>
        </Card>
      </div>
    </div>
  );
}
