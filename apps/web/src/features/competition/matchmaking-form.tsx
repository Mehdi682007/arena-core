'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Field, Select } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { productMessagesFor } from '@/i18n/product-messages';
import { browserApi } from '@/lib/api/browser-api-client';
import type { CatalogGame, GameAccount } from './types';

export function MatchmakingForm({
  games,
  accounts,
  locale,
}: {
  games: readonly CatalogGame[];
  accounts: readonly GameAccount[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const messages = productMessagesFor(locale).matchmaking;
  const verified = useMemo(
    () => accounts.filter((item) => item.status === 'VERIFIED'),
    [accounts],
  );
  const initialGame = games.find((game) =>
    verified.some((account) => account.game.id === game.id),
  ) ?? games[0];
  const [gameId, setGameId] = useState(initialGame?.id ?? '');
  const selectedGame = games.find((game) => game.id === gameId) ?? initialGame;
  const compatibleAccounts = verified.filter((account) => account.game.id === selectedGame?.id);
  const [modeId, setModeId] = useState(initialGame?.modes[0]?.id ?? '');
  const [accountId, setAccountId] = useState(
    verified.find((account) => account.game.id === initialGame?.id)?.id ?? '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (!games.length) {
    return <EmptyState title={messages.noGames} />;
  }

  if (!verified.length) {
    return (
      <EmptyState title={messages.noVerifiedIdentity}>
        <a className="button secondary" href="/profile">
          {messages.viewProfile}
        </a>
      </EmptyState>
    );
  }

  function changeGame(nextGameId: string) {
    const game = games.find((item) => item.id === nextGameId);
    const nextAccount = verified.find((account) => account.game.id === nextGameId);
    setGameId(nextGameId);
    setModeId(game?.modes[0]?.id ?? '');
    setAccountId(nextAccount?.id ?? '');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const game = games.find((item) => item.id === gameId);
    const mode = game?.modes.find((item) => item.id === modeId);
    const account = verified.find((item) => item.id === accountId && item.game.id === gameId);
    try {
      if (!game || !mode || !account) throw new Error('invalid');
      const ruleset = await browserApi<{ id: string }>(
        `/catalog/games/${game.slug}/rulesets/default?modeKey=${encodeURIComponent(mode.key)}`,
      );
      await browserApi('/matchmaking/requests', {
        method: 'POST',
        body: {
          userGameAccountId: account.id,
          gameModeId: mode.id,
          gameRulesetId: ruleset.id,
          searchScope: data.get('scope'),
          criteria: { language: locale },
        },
      });
      router.replace('/matchmaking');
      router.refresh();
    } catch {
      setError(messages.createFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field name="gameId" label={messages.game}>
        <Select
          id="gameId"
          name="gameId"
          value={gameId}
          onChange={(event) => changeGame(event.target.value)}
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field name="gameModeId" label={messages.mode}>
        <Select
          id="gameModeId"
          name="gameModeId"
          value={modeId}
          onChange={(event) => setModeId(event.target.value)}
        >
          {selectedGame?.modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field name="accountId" label={messages.gameIdentity}>
        <Select
          id="accountId"
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          disabled={!compatibleAccounts.length}
        >
          {compatibleAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayHandle} — {account.platform.name}
            </option>
          ))}
        </Select>
        {!compatibleAccounts.length ? <p className="muted">{messages.noCompatibleIdentity}</p> : null}
      </Field>

      <Field name="scope" label={messages.searchScope}>
        <Select id="scope" name="scope">
          <option value="CROSSPLAY_GROUP">{messages.crossplay}</option>
          <option value="SAME_PLATFORM">{messages.samePlatform}</option>
        </Select>
      </Field>

      {error ? <Alert error>{error}</Alert> : null}
      <Button disabled={pending || !selectedGame || !modeId || !accountId}>
        {pending ? messages.creating : messages.startSearch}
      </Button>
    </form>
  );
}
