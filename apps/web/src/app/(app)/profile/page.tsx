import Link from 'next/link';
import { Alert, Avatar, Card } from '@/components/ui';
import { ProfileForm, type ProfileView } from '@/features/profile/profile-form';
import type { MatchView } from '@/features/competition/types';
import type { GameAccountView } from '@/features/settings/game-account-manager';
import type { UserSessionView } from '@/features/settings/session-manager';
import { messagesFor } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import { uiMessagesFor } from '@/i18n/ui-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function ProfilePage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);

  const [result, gameAccounts, sessions, matches, ratings] = await Promise.all([
    serverApi<{
      profile: ProfileView;
      onboarding: { completed: boolean; missingSteps: string[] };
    }>('/profile'),

    serverApi<readonly GameAccountView[]>('/game-accounts').catch(() => []),

    serverApi<{ items: readonly UserSessionView[] }>('/auth/sessions').catch(() => ({ items: [] })),

    serverApi<readonly MatchView[]>('/matches?limit=50').catch(() => []),

    serverApi<
      readonly {
        gameKey: string;
        modeKey: string;
        rating: number;
        matchesPlayed: number;
      }[]
    >('/ratings').catch(() => []),
  ]);

  const messages = messagesFor(result.profile.locale).profile;

  const remainingSteps = result.onboarding.missingSteps.map(
    (step) => messages.missingSteps[step] ?? ui.uncertain,
  );

  const primary = gameAccounts.find((account) => account.isPrimary);

  const activeSessions = sessions.items.filter((session) => session.status === 'ACTIVE');

  const wins = matches.filter((match) => match.status === 'COMPLETED').length;
  const losses = matches.filter((match) => match.status === 'CANCELLED').length;

  const totalMatches = matches.length;

  const totalGames = ratings.reduce((sum, item) => sum + item.matchesPlayed, 0);

  const highestRating = ratings.reduce((max, item) => Math.max(max, item.rating), 0);

  const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US');

  return (
    <div className="profile-dashboard">
      <Card>
        <div className="profile-hero">
          <Avatar name={result.profile.displayName ?? ui.arenaUser} />

          <div>
            <h1>{result.profile.displayName ?? messages.title}</h1>

            <p>{result.onboarding.completed ? messages.completed : messages.incomplete}</p>

            <p className="muted">
              {result.profile.countryCode ?? '—'} · {result.profile.timezone ?? 'UTC'} ·{' '}
              {result.profile.locale.toUpperCase()}
            </p>
          </div>
        </div>
      </Card>

      {!result.onboarding.completed ? (
        <Alert>
          {messages.remainingSteps}: {remainingSteps.join(', ')}
        </Alert>
      ) : null}

      <div className="profile-stat-grid">
        <Card>
          <strong>{number.format(totalMatches)}</strong>
          <span>{ui.matchesPlayed}</span>
        </Card>

        <Card>
          <strong>{number.format(wins)}</strong>
          <span>Wins</span>
        </Card>

        <Card>
          <strong>{number.format(losses)}</strong>
          <span>Losses</span>
        </Card>

        <Card>
          <strong>{number.format(highestRating)}</strong>
          <span>{ui.highestRating}</span>
        </Card>

        <Card>
          <strong>{number.format(totalGames)}</strong>
          <span>{ui.gamesPlayed}</span>
        </Card>
      </div>

      <div className="profile-content-grid">
        <Card>
          <h2>{ui.gameAccounts}</h2>

          <p>
            {number.format(gameAccounts.length)} {ui.connectedIdentity}
          </p>

          {primary ? (
            <p>
              {ui.original}: <span className="ltr">{primary.displayHandle}</span> ·{' '}
              {primary.platform.name}
            </p>
          ) : (
            <p className="muted">{ui.thereIsNoVerifiedPrimaryAccount}</p>
          )}

          <Link className="button secondary" href="/settings/game-accounts">
            {ui.accountsManagement}
          </Link>
        </Card>

        <Card>
          <h2>{ui.accountSecurity}</h2>

          <p>
            {result.onboarding.completed
              ? ui.identitySetupIsComplete
              : ui.securitySettingsRequireAttention}
          </p>

          <Link className="button secondary" href="/settings/security/mfa">
            {ui.securitySettings}
          </Link>
        </Card>

        <Card>
          <h2>{ui.activeMeetings}</h2>

          <p>{number.format(activeSessions.length)}</p>

          <Link className="button secondary" href="/settings/sessions">
            {ui.reviewMeetings}
          </Link>
        </Card>
      </div>

      <Card>
        <h2>{messages.basicInformation}</h2>

        <ProfileForm profile={result.profile} />
      </Card>
    </div>
  );
}
