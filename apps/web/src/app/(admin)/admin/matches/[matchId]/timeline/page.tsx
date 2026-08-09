import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { notFound } from 'next/navigation';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { Timeline } from '@/features/admin/components';
export default async function MatchTimeline({ params }: { params: Promise<{ matchId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('timeline.read');
  const { matchId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) notFound();
  return (
    <div className="stack">
      <h1>{ui.timelineOfTheCompetition}</h1>
      <p className="ltr">{matchId}</p>
      <Timeline items={await adminApi.matchTimeline(matchId)} />
    </div>
  );
}
