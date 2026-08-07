import { Badge, Card } from '@/components/ui';
import { DisputeForm } from '@/features/competition/dispute-form';
import { competitionMessagesFor } from '@/features/competition/messages';
import type { DisputeView } from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export default async function DisputePage({ params }: { params: Promise<{ matchId: string }> }) {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = competitionMessagesFor(locale).dispute;
  const dateLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  const { matchId } = await params;
  const disputes = await serverApi<DisputeView[]>(`/matches/${matchId}/disputes`).catch(() => []);
  const active = disputes.find((item) =>
    ['AWAITING_RESPONSE', 'UNDER_REVIEW'].includes(item.status),
  );
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      {disputes.map((item) => (
        <Card key={item.id}>
          <Badge>{item.status}</Badge>
          <p>{item.reasonCode}</p>
          <p>{item.statement}</p>
          {item.resolutionType ? (
            <p>
              {messages.resolution}: {item.resolutionType}
              {item.resolvedAt ? (
                <>
                  {' — '}
                  <time dateTime={item.resolvedAt}>
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(item.resolvedAt))}
                  </time>
                </>
              ) : null}
            </p>
          ) : null}
          <p>
            {messages.responseDeadline}:{' '}
            <time dateTime={item.responseDeadlineAt}>
              {new Intl.DateTimeFormat(dateLocale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(item.responseDeadlineAt))}
            </time>
          </p>
        </Card>
      ))}
      {active && !active.hasResponse ? (
        <DisputeForm matchId={matchId} disputeId={active.id} locale={locale} />
      ) : (
        <DisputeForm matchId={matchId} locale={locale} />
      )}
    </div>
  );
}
