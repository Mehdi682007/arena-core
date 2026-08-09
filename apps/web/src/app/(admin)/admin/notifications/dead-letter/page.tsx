import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { OutboxTable } from '@/features/admin/components';
export default async function DeadLetterPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('notifications.read');
  const page = await adminApi.deadLetter();
  return (
    <div className="stack">
      <h1>{ui.deadLetterMessages}</h1>
      <OutboxTable items={page.items} />
    </div>
  );
}
