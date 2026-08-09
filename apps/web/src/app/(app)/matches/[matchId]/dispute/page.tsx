import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { Badge, Card } from '@/components/ui';
import { DisputeForm } from '@/features/competition/dispute-form';
import type { DisputeView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
import { presentReason, presentStatus } from '@/i18n/presentation';
export default async function DisputePage({ params }: { params: Promise<{ matchId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const { matchId } = await params;
  const disputes = await serverApi<DisputeView[]>(`/matches/${matchId}/disputes`).catch(() => []);
  const active = disputes.find((item) =>
    ['AWAITING_RESPONSE', 'UNDER_REVIEW'].includes(item.status),
  );
  return (
    <div className="stack">
      <h1>{ui.contestProtest}</h1>
      {disputes.map((item) => (
        <Card key={item.id}>
          <Badge>{presentStatus(item.status, locale)}</Badge>
          <p>{presentReason(item.reasonCode, locale)}</p>
          <p>{item.statement}</p>
          {item.resolutionType ? (
            <p>
              {ui.theResultOfTheInvestigation}
              {item.resolutionType}
              {item.resolvedAt ? (
                <>
                  {' — '}
                  <time dateTime={item.resolvedAt}>
                    {new Intl.DateTimeFormat('fa', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(item.resolvedAt))}
                  </time>
                </>
              ) : null}
            </p>
          ) : null}
          <p>
            {ui.responseDeadline}{' '}
            <time dateTime={item.responseDeadlineAt}>
              {new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(item.responseDeadlineAt),
              )}
            </time>
          </p>
        </Card>
      ))}
      {active && !active.hasResponse ? (
        <DisputeForm matchId={matchId} disputeId={active.id} />
      ) : (
        <DisputeForm matchId={matchId} />
      )}
    </div>
  );
}
