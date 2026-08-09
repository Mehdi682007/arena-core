import Link from 'next/link';
import { Card } from '@/components/ui';
import { requireAdminPermission } from '@/features/admin/access';
import { adminDictionaries } from '@/i18n/admin-dictionary';
import { getRequestLocale } from '@/i18n/server';
export default async function NotificationAdminPage() {
  await requireAdminPermission('notifications.read');
  const dictionary = adminDictionaries[await getRequestLocale()];
  return (
    <div className="stack">
      <h1>{dictionary.items.notifications.label}</h1>
      <div className="grid">
        <Card>
          <h2>{dictionary.common.outbox}</h2>
          <Link href="/admin/notifications/outbox">{dictionary.common.viewMessages}</Link>
        </Card>
        <Card>
          <h2>{dictionary.common.deadLetter}</h2>
          <Link href="/admin/notifications/dead-letter">{dictionary.common.stoppedMessages}</Link>
        </Card>
        <Card>
          <h2>{dictionary.common.recovery}</h2>
          <Link href="/admin/support">{dictionary.common.recoveryOperations}</Link>
        </Card>
      </div>
    </div>
  );
}
