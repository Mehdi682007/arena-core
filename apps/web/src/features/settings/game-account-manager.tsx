'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { rc4MessagesFor } from '@/i18n/rc4-messages';
import { browserApi } from '@/lib/api/browser-api-client';

interface CatalogIdentity {
  readonly id: string;
  readonly key: string;
  readonly slug: string;
  readonly name: string;
}

export interface ClaimableGamePlatformView {
  readonly game: CatalogIdentity;
  readonly platform: CatalogIdentity;
  readonly gamePlatformId: string;
}

export interface GameAccountView {
  readonly id: string;
  readonly game: CatalogIdentity;
  readonly platform: CatalogIdentity;
  readonly displayHandle: string;
  readonly status:
    | 'DRAFT'
    | 'PENDING'
    | 'VERIFIED'
    | 'REJECTED'
    | 'CHANGES_REQUESTED'
    | 'SUSPENDED'
    | 'DISCONNECTED';
  readonly isPrimary: boolean;
  readonly verifiedAt: string | null;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly gamePlatformId: string;
  readonly createdAt: string;
  readonly version: number;
  readonly deletedAt: string | null;
  readonly rejectionReasonCode: string | null;
  readonly reviewMessage: string | null;
  readonly suspensionReasonCode: string | null;
}

export function GameAccountManager({
  initialAccounts,
  claimablePlatforms,
  locale,
}: {
  initialAccounts: readonly GameAccountView[];
  claimablePlatforms: readonly ClaimableGamePlatformView[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const messages = rc4MessagesFor(locale).gameAccounts;

  const activePairs = useMemo(
    () =>
      new Set(
        initialAccounts
          .filter((account) => account.status !== 'DISCONNECTED')
          .map((account) => `${account.game.id}:${account.platform.id}`),
      ),
    [initialAccounts],
  );

  const available = useMemo(
    () =>
      claimablePlatforms.filter((item) => !activePairs.has(`${item.game.id}:${item.platform.id}`)),
    [activePairs, claimablePlatforms],
  );

  const games = useMemo(() => {
    const unique = new Map<string, CatalogIdentity>();

    for (const item of available) {
      unique.set(item.game.id, item.game);
    }

    return [...unique.values()];
  }, [available]);

  const first = available[0];

  const [gameId, setGameId] = useState(first?.game.id ?? '');

  const [gamePlatformId, setGamePlatformId] = useState(first?.gamePlatformId ?? '');

  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>();

  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const platforms = available.filter((item) => item.game.id === gameId);

  async function create(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!gameId || !gamePlatformId) {
      return;
    }

    setPending(true);
    setError(false);
    setSuccess(false);

    const data = new FormData(event.currentTarget);
    const handle = data.get('handle');

    try {
      await browserApi('/game-accounts', {
        method: 'POST',
        body: {
          gameId,
          gamePlatformId,
          handle: typeof handle === 'string' ? handle : '',
        },
      });

      setSuccess(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function action(
    accountId: string,
    operation: 'primary' | 'disconnect' | 'resubmit' | 'submit' | 'delete' | 'restore',
  ): Promise<void> {
    setPendingAction(`${accountId}:${operation}`);
    setError(false);

    try {
      const version = initialAccounts.find((item) => item.id === accountId)?.version;
      const resource = `/game-accounts/${encodeURIComponent(accountId)}`;
      await browserApi(operation === 'delete' ? resource : `${resource}/${operation}`, {
        method: operation === 'delete' ? 'DELETE' : 'POST',
        body: ['submit', 'delete', 'restore'].includes(operation)
          ? { expectedVersion: version }
          : {},
      });

      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <div className="stack">
      {error ? <Alert error>{messages.failed}</Alert> : null}

      {success ? <Alert>{messages.created}</Alert> : null}

      <Card>
        <h2>{messages.add}</h2>

        {available.length === 0 ? (
          <p className="muted">{messages.noPlatform}</p>
        ) : (
          <form
            className="form"
            onSubmit={(event) => {
              void create(event);
            }}
          >
            <Field name="gameId" label={messages.game}>
              <Select
                id="gameId"
                name="gameId"
                value={gameId}
                onChange={(event) => {
                  const nextGameId = event.target.value;

                  const firstPlatform = available.find((item) => item.game.id === nextGameId);

                  setGameId(nextGameId);

                  setGamePlatformId(firstPlatform?.gamePlatformId ?? '');
                }}
                required
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field name="gamePlatformId" label={messages.platform}>
              <Select
                id="gamePlatformId"
                name="gamePlatformId"
                value={gamePlatformId}
                onChange={(event) => {
                  setGamePlatformId(event.target.value);
                }}
                required
              >
                {platforms.map((item) => (
                  <option key={item.gamePlatformId} value={item.gamePlatformId}>
                    {item.platform.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field name="handle" label={messages.handle}>
              <Input id="handle" name="handle" dir="ltr" minLength={1} maxLength={128} required />
            </Field>

            <Button type="submit" disabled={pending}>
              {pending ? messages.submitting : messages.submit}
            </Button>
          </form>
        )}
      </Card>

      <section className="stack">
        <h2>{messages.accounts}</h2>

        {initialAccounts.length === 0 ? <p className="muted">{messages.empty}</p> : null}

        {initialAccounts.map((account) => (
          <Card key={account.id} data-deleted={account.deletedAt ? 'true' : undefined}>
            <div className="cluster">
              <Link
                className="button secondary"
                href={`/account/game-accounts/${encodeURIComponent(account.id)}`}
              >
                {messages.details}
              </Link>
              <strong>
                {account.game.name}
                {' · '}
                {account.platform.name}
              </strong>

              <Badge>{messages.status[account.status]}</Badge>

              {account.isPrimary ? <Badge>{messages.primary}</Badge> : null}
            </div>

            <p className="ltr">{account.displayHandle}</p>

            {account.reviewMessage ? <Alert>{account.reviewMessage}</Alert> : null}

            <div className="cluster">
              {account.deletedAt ? (
                <Button
                  className="secondary"
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    void action(account.id, 'restore');
                  }}
                >
                  {pendingAction === `${account.id}:restore` ? messages.working : messages.restore}
                </Button>
              ) : null}

              {!account.deletedAt && account.status === 'VERIFIED' && !account.isPrimary ? (
                <Button
                  className="secondary"
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    void action(account.id, 'primary');
                  }}
                >
                  {pendingAction === `${account.id}:primary`
                    ? messages.working
                    : messages.makePrimary}
                </Button>
              ) : null}

              {!account.deletedAt &&
              (account.status === 'DRAFT' || account.status === 'CHANGES_REQUESTED') ? (
                <Button
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    void action(account.id, 'submit');
                  }}
                >
                  {pendingAction === `${account.id}:submit`
                    ? messages.working
                    : messages.submitForReview}
                </Button>
              ) : null}

              {!account.deletedAt && account.status === 'REJECTED' ? (
                <Button
                  className="secondary"
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    void action(account.id, 'resubmit');
                  }}
                >
                  {pendingAction === `${account.id}:resubmit`
                    ? messages.working
                    : messages.resubmit}
                </Button>
              ) : null}

              {!account.deletedAt && account.status !== 'DISCONNECTED' ? (
                <Button
                  className="danger"
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    void action(account.id, 'disconnect');
                  }}
                >
                  {pendingAction === `${account.id}:disconnect`
                    ? messages.working
                    : messages.disconnect}
                </Button>
              ) : null}

              {!account.deletedAt ? (
                <Button
                  className="danger"
                  disabled={pendingAction !== undefined}
                  onClick={() => {
                    if (window.confirm(messages.delete)) void action(account.id, 'delete');
                  }}
                >
                  {pendingAction === `${account.id}:delete` ? messages.working : messages.delete}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
