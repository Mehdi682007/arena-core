import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { statusLabel } from '@/features/competition/presentation';
import type { MatchView } from '@/features/competition/types';
import { serverApi } from '@/lib/api/server-api-client';
export default async function MatchesPage() {
  const matches = await serverApi<MatchView[]>('/matches?limit=50');
  if (!matches.length)
    return (
      <EmptyState title="مسابقه‌ای ندارید">
        <Link className="button" href="/matchmaking">
          شروع رقابت
        </Link>
      </EmptyState>
    );
  return (
    <div className="stack">
      <h1>مسابقه‌ها</h1>
      <div className="grid">
        {matches.map((match) => (
          <Card key={match.id}>
            <h2>{match.game.name}</h2>
            <Badge>{statusLabel(match.status)}</Badge>
            <p>
              {match.mode.name} — حریف:{' '}
              {match.participants.find((item) => !item.isCurrentUser)?.displayHandle ?? 'نامشخص'}
            </p>
            <Link className="button secondary" href={`/matches/${match.id}`}>
              اتاق مسابقه
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
