import { Card } from '@/components/ui';
import { competitionMessagesFor } from '@/features/competition/messages';
import { EvidenceForm, ResultForm } from '@/features/competition/result-form';
import type { EvidenceView, ResultView } from '@/features/competition/types';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export default async function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const session = await getSession();
  if (session.status !== 'authenticated') return null;
  const locale = session.user.locale;
  const messages = competitionMessagesFor(locale).result;
  const { matchId } = await params;
  const [result, evidence] = await Promise.all([
    serverApi<ResultView>(`/matches/${matchId}/result`),
    serverApi<EvidenceView[]>(`/matches/${matchId}/evidence`),
  ]);
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      <Card>
        <p>
          {messages.status}: {result.status}
        </p>
        <p>
          {messages.yourSubmission}: {result.submission.status}
        </p>
        {result.scores?.map((score) => (
          <span key={score.side}>
            {score.side}: {score.score}{' '}
          </span>
        ))}
      </Card>
      {!['CONFIRMED', 'ADMIN_RESOLVED', 'VOIDED'].includes(result.status) ? (
        <ResultForm matchId={matchId} locale={locale} />
      ) : null}
      <EvidenceForm matchId={matchId} locale={locale} />
      <section>
        <h2>{messages.yourStatements}</h2>
        {evidence.map((item) => (
          <Card key={item.id}>
            <p>
              {item.type} — {item.status}
            </p>
            <p>{item.description}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
