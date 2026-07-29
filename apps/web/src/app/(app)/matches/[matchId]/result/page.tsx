import { Card } from '@/components/ui';
import { EvidenceForm, ResultForm } from '@/features/competition/result-form';
import type { EvidenceView, ResultView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const [result, evidence] = await Promise.all([
    serverApi<ResultView>(`/matches/${matchId}/result`),
    serverApi<EvidenceView[]>(`/matches/${matchId}/evidence`),
  ]);
  return (
    <div className="stack">
      <h1>نتیجه مسابقه</h1>
      <Card>
        <p>وضعیت: {result.status}</p>
        <p>ارسال شما: {result.submission.status}</p>
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
        <h2>اظهارهای شما</h2>
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
