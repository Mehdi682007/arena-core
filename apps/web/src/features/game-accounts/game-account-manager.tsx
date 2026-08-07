'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { gameAccountMessagesFor } from '@/i18n/game-account-messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import type { ClaimableGamePlatform, UserGameAccountView } from './types';

export function GameAccountManager({
  initialAccounts,
  claimablePlatforms,
  locale,
}: {
  initialAccounts: readonly UserGameAccountView[];
  claimablePlatforms: readonly ClaimableGamePlatform[];
  locale: AppLocale;
}) {
  const messages = gameAccountMessagesFor(locale);
  const games = useMemo(
    () =>
      claimablePlatforms.filter(
        (item, index, all) => all.findIndex((candidate) => candidate.game.id === item.game.id) === index,
      ),
    [claimablePlatforms],
  );
  const [accounts, setAccounts] = useState<readonly UserGameAccountView[]>(initialAccounts);
  const [gameId, setGameId] = useState(games[0]?.game.id ?? '');
  const platforms = claimablePlatforms.filter((item) => item.game.id === gameId);
  const [gamePlatformId, setGamePlatformId] = useState(platforms[0]?.gamePlatformId ?? '');
  const [pending, setPending] = useState(false);
  const [actionId, setActionId] = useState<string>();
  const [error, setError] = useState('');

  function changeGame(nextGameId: string) {
    const nextPlatforms = claimablePlatforms.filter((item) => item.game.id === nextGameId);
    setGameId(nextGameId);
    setGamePlatformId(nextPlatforms[0]?.gamePlatformId ?? '');
    setError('');
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const created = await browserApi<UserGameAccountView>('/game-accounts', {
        method: 'POST',
        body: {
          gameId,
          gamePlatformId,
          handle: String(data.get('handle') ?? '').trim(),
        },
      });
      setAccounts((current) => [created, ...current]);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : messages.createFailed);
    } finally {
      setPending(false);
    }
  }

  async function action(
    account: UserGameAccountView,
    operation: 'primary' | 'disconnect' | 'resubmit',
  ) {
    if (operation === 'disconnect' && !window.confirm(messages.confirmDisconnect)) return;
    setActionId(account.id);
    setError('');
    try {
      if (operation === 'resubmit') {
        const updated = await browserApi<UserGameAccountView>(
          `/game-accounts/${encodeURIComponent(account.id)}/resubmit`,
          { method: 'POST', body: {} },
        );
        setAccounts((current) =>
          current.map((item) => (item.id === account.id ? updated : item)),
        );
      } else {
        await browserApi(`/game-accounts/${encodeURIComponent(account.id)}/${operation}`, {
          method: 'POST',
          body: {},
        });
        setAccounts((current) =>
          current.map((item) => {
            if (operation === 'primary') {
              return item.game.id === account.game.id
                ? { ...item, isPrimary: item.id === account.id }
                : item;
            }
            return item.id === account.id
              ? { ...item, status: 'DISCONNECTED' as const, isPrimary: false }
              : item;
          }),
        );
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : messages.actionFailed);
    } finally {
      setActionId(undefined);
    }
  }

  return (
    <div className="stack">
      {error ? <Alert error>{error}</Alert> : null}

      <Card>
        <h2>{messages.addTitle}</h2>
        {!claimablePlatforms.length ? (
          <EmptyState title={messages.noClaimablePlatforms} />
        ) : (
          <form className="form" onSubmit={create}>
            <Field name="gameId" label={messages.game}>
              <Select
                id="gameId"
                name="gameId"
                value={gameId}
                onChange={(event) => changeGame(event.target.value)}
              >
                {games.map((item) => (
                  <option key={item.game.id} value={item.game.id}>
                    {item.game.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field name="gamePlatformId" label={messages.platform}>
              <Select
                id="gamePlatformId"
                name="gamePlatformId"
                value={gamePlatformId}
                onChange={(event) => setGamePlatformId(event.target.value)}
              >
                {platforms.map((item) => (
                  <option key={item.gamePlatformId} value={item.gamePlatformId}>
                    {item.platform.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field name="handle" label={messages.handle}>
              <Input id="handle" name="handle" dir="ltr" maxLength={256} required />
              <p className="muted">{messages.handleHint}</p>
            </Field>

            <Button disabled={pending || !gameId || !gamePlatformId}>
              {pending ? messages.creating : messages.create}
            </Button>
          </form>
        )}
      </Card>

      <section className="stack">
        <h2>{messages.accountsTitle}</h2>
        {!accounts.length ? <EmptyState title={messages.noAccounts} /> : null}
        {accounts.map((account) => (
          <Card key={account.id}>
            <div className="stack">
              <div className="cluster">
                <strong>{account.game.name}</strong>
                <Badge>{messages.status[account.status] ?? account.status}</Badge>
                {account.isPrimary ? <Badge>{messages.primary}</Badge> : null}
              </div>
              <div>
                {account.platform.name} — <span className="ltr">{account.displayHandle}</span>
              </div>
              <div className="cluster">
                {account.status === 'VERIFIED' && !account.isPrimary ? (
                  <Button
                    type="button"
                    className="secondary"
                    disabled={actionId === account.id}
                    onClick={() => void action(account, 'primary')}
                  >
                    {messages.setPrimary}
                  </Button>
                ) : null}
                {account.status === 'REJECTED' ? (
                  <Button
                    type="button"
                    className="secondary"
                    disabled={actionId === account.id}
                    onClick={() => void action(account, 'resubmit')}
                  >
                    {messages.resubmit}
                  </Button>
                ) : null}
                {account.status !== 'DISCONNECTED' ? (
                  <Button
                    type="button"
                    className="danger"
                    disabled={actionId === account.id}
                    onClick={() => void action(account, 'disconnect')}
                  >
                    {messages.disconnect}
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
