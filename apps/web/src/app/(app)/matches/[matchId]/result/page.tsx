import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { Card } from '@/components/ui';
import { EvidenceForm, ResultForm } from '@/features/competition/result-form';
import type { EvidenceView, ResultView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
import { presentEvidenceType, presentStatus } from '@/i18n/presentation';
export default async function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const { matchId } = await params;
  const [result, evidence] = await Promise.all([
    serverApi<ResultView>(`/matches/${matchId}/result`),
    serverApi<EvidenceView[]>(`/matches/${matchId}/evidence`),
  ]);
  return (
    <div className="stack">
      <h1>{ui.theResultOfTheMatch}</h1>
      <Card>
        <p>
          {ui.status2}
          {presentStatus(result.status, locale)}
        </p>
        <p>
          {ui.yourSubmission}
          {presentStatus(result.submission.status, locale)}
        </p>
        {result.scores?.map((score) => (
          <span key={score.side}>
            {score.side}: {score.score}{' '}
          </span>
        ))}
      </Card>
      {!['CONFIRMED', 'ADMIN_RESOLVED', 'VOIDED'].includes(result.status) ? (
        <ResultForm matchId={matchId} />
      ) : null}
      <EvidenceForm matchId={matchId} />
      <section>
        <h2>{ui.yourStatements}</h2>
        {evidence.map((item) => (
          <Card key={item.id}>
            <p>
              {presentEvidenceType(item.type, locale)} — {presentStatus(item.status, locale)}
            </p>
            <p>{item.description}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
