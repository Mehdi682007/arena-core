import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { OutboxTable } from '@/features/admin/components';
export default async function DeadLetterPage() {
  await requireAdminPermission('notifications.read');
  const page = await adminApi.deadLetter();
  return (
    <div className="stack">
      <h1>پیام‌های Dead-letter</h1>
      <OutboxTable items={page.items} />
    </div>
  );
}
