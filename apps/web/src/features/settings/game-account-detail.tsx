'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { uiMessagesFor } from '@/i18n/ui-messages';
import { presentStatus } from '@/i18n/presentation';
import { browserApi } from '@/lib/api/browser-api-client';
import type { GameAccountView } from './game-account-manager';

const faUi = uiMessagesFor('fa');

const copy = {
  en: {
    title: 'Game account',
    edit: 'Edit identity',
    handle: 'Player handle',
    save: 'Save changes',
    saving: 'Saving…',
    pending: 'Changing a verified identity sends it back for review.',
    timeline: 'Lifecycle',
    created: 'Account created',
    submitted: 'Submitted for review',
    reviewed: 'Reviewed',
    verified: 'Verified',
    failed: 'The account could not be updated.',
    conflict: 'This account changed elsewhere. Refresh and try again.',
    back: 'Back to game accounts',
  },
  fa: {
    title: faUi.gameAccount,
    edit: faUi.editIdentity,
    handle: faUi.playerId,
    save: faUi.saveChanges,
    saving: faUi.saving,
    pending: faUi.changingAVerifiedIdentitySendsTheAccount,
    timeline: faUi.statusHistory,
    created: faUi.accountCreated,
    submitted: faUi.submittedForReview,
    reviewed: faUi.reviewed,
    verified: faUi.verified,
    failed: faUi.couldNotUpdateTheAccount,
    conflict: faUi.theAccountWasChangedElsewhereRefreshThe,
    back: faUi.backToGameAccounts,
  },
} as const;

export function GameAccountDetail({
  account,
  locale,
}: {
  account: GameAccountView;
  locale: AppLocale;
}) {
  const router = useRouter();
  const text = copy[locale];
  const [handle, setHandle] = useState(account.displayHandle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'generic' | 'conflict'>();
  const editable =
    ['DRAFT', 'CHANGES_REQUESTED', 'VERIFIED'].includes(account.status) && !account.deletedAt;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await browserApi(`/game-accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        body: {
          gameId: account.game.id,
          gamePlatformId: account.gamePlatformId,
          handle,
          expectedVersion: account.version,
        },
      });
      router.refresh();
    } catch (cause) {
      setError(String(cause).includes('VERSION_CONFLICT') ? 'conflict' : 'generic');
    } finally {
      setPending(false);
    }
  }
  const events: { label: string; at: string }[] = [{ label: text.created, at: account.createdAt }];
  if (account.submittedAt) events.push({ label: text.submitted, at: account.submittedAt });
  if (account.reviewedAt) events.push({ label: text.reviewed, at: account.reviewedAt });
  if (account.verifiedAt) events.push({ label: text.verified, at: account.verifiedAt });
  return (
    <div className="stack">
      <Button className="secondary" onClick={() => router.push('/account/game-accounts')}>
        {text.back}
      </Button>
      <Card>
        <div className="cluster">
          <h1>{text.title}</h1>
          <Badge>{presentStatus(account.status, locale)}</Badge>
          {account.isPrimary ? <Badge>Primary</Badge> : null}
        </div>
        <p>
          {account.game.name} · {account.platform.name}
        </p>
        <p className="ltr">{account.displayHandle}</p>
        {account.reviewMessage ? <Alert>{account.reviewMessage}</Alert> : null}
      </Card>
      {editable ? (
        <Card>
          <h2>{text.edit}</h2>
          {account.status === 'VERIFIED' ? <Alert>{text.pending}</Alert> : null}
          {error ? <Alert error>{error === 'conflict' ? text.conflict : text.failed}</Alert> : null}
          <form className="form" onSubmit={submit}>
            <Field name="handle" label={text.handle}>
              <Input
                id="handle"
                dir="ltr"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                minLength={1}
                maxLength={256}
                required
              />
            </Field>
            <Button disabled={pending || handle.trim() === account.displayHandle}>
              {pending ? text.saving : text.save}
            </Button>
          </form>
        </Card>
      ) : null}
      <Card>
        <h2>{text.timeline}</h2>
        <ol className="timeline">
          {events.map((event) => (
            <li key={`${event.label}:${event.at}`}>
              <strong>{event.label}</strong>
              <time dateTime={event.at}>
                {new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(event.at))}
              </time>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
