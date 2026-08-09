'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Field, Select } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import type { CatalogGame, GameAccount } from './types';
export function MatchmakingForm({
  games,
  accounts,
}: {
  games: readonly CatalogGame[];
  accounts: readonly GameAccount[];
}) {
  const ui = useUiMessages();
  const router = useRouter();
  const verified = accounts.filter((item) => item.status === 'VERIFIED');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!verified.length)
    return (
      <EmptyState title={ui.youDoNotHaveAVerifiedGame}>
        <a className="button secondary" href="/profile">
          {ui.viewProfile}
        </a>
      </EmptyState>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const game = games.find((item) => item.id === data.get('gameId'));
    const mode = game?.modes.find((item) => item.id === data.get('gameModeId'));
    try {
      if (!game || !mode) throw new Error('invalid');
      const ruleset = await browserApi<{ id: string }>(
        `/catalog/games/${game.slug}/rulesets/default?modeKey=${encodeURIComponent(mode.key)}`,
      );
      await browserApi('/matchmaking/requests', {
        method: 'POST',
        body: {
          userGameAccountId: data.get('accountId'),
          gameModeId: mode.id,
          gameRulesetId: ruleset.id,
          searchScope: data.get('scope'),
          criteria: { language: 'fa' },
        },
      });
      router.replace('/matchmaking');
      router.refresh();
    } catch {
      setError(ui.couldNotCreateTheRequestCheckThe);
    } finally {
      setPending(false);
    }
  }
  const first = games[0];
  return (
    <form className="form" onSubmit={submit}>
      <Field name="gameId" label={ui.game}>
        <Select id="gameId" name="gameId">
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field name="gameModeId" label={ui.mode}>
        <Select id="gameModeId" name="gameModeId">
          {first?.modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field name="accountId" label={ui.theIdentityOfTheGame}>
        <Select id="accountId" name="accountId">
          {verified.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayHandle} — {account.platform.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field name="scope" label={ui.searchRange}>
        <Select id="scope" name="scope">
          <option value="CROSSPLAY_GROUP">{ui.crossplayCompatible}</option>
          <option value="SAME_PLATFORM">{ui.samePlatform}</option>
        </Select>
      </Field>
      {error ? <Alert error>{error}</Alert> : null}
      <Button disabled={pending}>{ui.creating}</Button>
    </form>
  );
}
