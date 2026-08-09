import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { notFound } from 'next/navigation';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { Timeline } from '@/features/admin/components';
export default async function UserTimeline({ params }: { params: Promise<{ userId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('timeline.read');
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  return (
    <div className="stack">
      <h1>{ui.userTimeline}</h1>
      <p className="ltr">{userId}</p>
      <Timeline items={await adminApi.userTimeline(userId)} />
    </div>
  );
}
