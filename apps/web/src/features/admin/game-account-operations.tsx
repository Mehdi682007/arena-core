'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import { useAppLocale } from '@/i18n/ui-messages-client';
import { presentAction, presentReason, presentStatus } from '@/i18n/presentation';
import type { AdminPermission } from './types';
import type { GameAccountView } from '../settings/game-account-manager';
import {
  GAME_ACCOUNT_REJECTION_REASON_CODES,
  GAME_ACCOUNT_SUSPENSION_REASON_CODES,
} from '@arena-core/contracts';

type Account = GameAccountView & {
  userId: string;
  normalizedHandle: string;
  reviewedByUserId: string | null;
  ownerDisplayName: string | null;
};
export type GameAccountPage = {
  items: readonly Account[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type Review = {
  id: string;
  action: string;
  reasonCode: string | null;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
};
const statuses = [
  '',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'SUSPENDED',
  'DISCONNECTED',
] as const;

export function GameAccountQueue({
  result,
  filters,
}: {
  result: GameAccountPage;
  filters: Readonly<Record<string, string>>;
}) {
  const locale = useAppLocale();
  const pageHref = (page: number) => {
    const query = new URLSearchParams(filters);
    query.set('page', String(page));
    return `/admin/game-accounts?${query.toString()}`;
  };
  return (
    <div className="stack">
      <div>
        <h1>Game account operations</h1>
        <p className="muted">Review identity claims and recent state changes.</p>
      </div>
      <Card>
        <form className="form-grid" action="/admin/game-accounts" method="get">
          <Field name="account-search" label="User or external ID">
            <Input id="account-search" name="userSearch" defaultValue={filters.userSearch} />
          </Field>
          <Field name="external-id" label="External ID">
            <Input id="external-id" name="externalId" defaultValue={filters.externalId} />
          </Field>
          <Field name="account-status" label="Status">
            <Select id="account-status" name="status" defaultValue={filters.status}>
              {statuses.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item ? presentStatus(item, locale) : 'All statuses'}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="account-game" label="Game ID">
            <Input id="account-game" name="gameId" defaultValue={filters.gameId} />
          </Field>
          <Field name="account-platform" label="Platform ID">
            <Input id="account-platform" name="platformId" defaultValue={filters.platformId} />
          </Field>
          <Field name="submitted-after" label="Submitted from">
            <Input
              id="submitted-after"
              name="submittedFrom"
              type="date"
              defaultValue={filters.submittedFrom}
            />
          </Field>
          <Field name="submitted-before" label="Submitted to">
            <Input
              id="submitted-before"
              name="submittedTo"
              type="date"
              defaultValue={filters.submittedTo}
            />
          </Field>
          <Field name="reviewer" label="Reviewer ID">
            <Input id="reviewer" name="reviewerUserId" defaultValue={filters.reviewerUserId} />
          </Field>
          <label className="cluster">
            <input
              type="checkbox"
              name="recentlyChanged"
              value="true"
              defaultChecked={filters.recentlyChanged === 'true'}
            />
            Recently changed
          </label>
          <input type="hidden" name="pageSize" value={String(result.pageSize)} />
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>
      {result.items.length === 0 ? (
        <Alert>No matching game accounts.</Alert>
      ) : (
        <div className="grid">
          {result.items.map((account) => (
            <Card key={account.id}>
              <div className="cluster">
                <Badge>{presentStatus(account.status, locale)}</Badge>
                {account.isPrimary ? <Badge>Primary</Badge> : null}
              </div>
              <h2>{account.displayHandle}</h2>
              <p>
                {account.game.name} · {account.platform.name}
              </p>
              <p className="muted ltr">User: {account.userId}</p>
              {account.ownerDisplayName ? <p>{account.ownerDisplayName}</p> : null}
              <Link
                className="button"
                href={`/admin/game-accounts/${encodeURIComponent(account.id)}`}
              >
                Open review
              </Link>
            </Card>
          ))}
        </div>
      )}
      <nav className="cluster" aria-label="Game account pages">
        {result.page > 1 ? (
          <Link className="button secondary" href={pageHref(result.page - 1)}>
            Previous
          </Link>
        ) : null}
        <span>
          Page {result.page} of {result.totalPages} · {result.total} results
        </span>
        {result.page < result.totalPages ? (
          <Link className="button secondary" href={pageHref(result.page + 1)}>
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

export function GameAccountReviewPanel({
  account,
  reviews,
  permissions,
}: {
  account: Account;
  reviews: readonly Review[];
  permissions: readonly AdminPermission[];
}) {
  const locale = useAppLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'generic' | 'conflict'>();
  const allowed = (permission: AdminPermission) => permissions.includes(permission);
  async function action(
    event: FormEvent<HTMLFormElement>,
    operation: 'verify' | 'reject' | 'request-changes' | 'suspend' | 'restore' | 'disconnect',
  ) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const reasonCode = String(data.get('reasonCode') ?? '').trim();
    const userMessage = String(data.get('userMessage') ?? '').trim();
    const note = String(data.get('note') ?? '').trim();
    try {
      await browserApi(`/admin/game-accounts/${encodeURIComponent(account.id)}/${operation}`, {
        method: 'POST',
        body: {
          expectedVersion: account.version,
          ...(reasonCode ? { reasonCode } : {}),
          ...(userMessage ? { userMessage } : {}),
          ...(note ? { note } : {}),
        },
      });
      router.refresh();
    } catch (cause) {
      setError(String(cause).includes('VERSION_CONFLICT') ? 'conflict' : 'generic');
    } finally {
      setPending(false);
    }
  }
  const forms: readonly [
    string,
    'verify' | 'reject' | 'request-changes' | 'suspend' | 'restore' | 'disconnect',
    AdminPermission,
    boolean,
  ][] = [
    ['Verify', 'verify', 'game_accounts.verify', false],
    ['Reject', 'reject', 'game_accounts.reject', true],
    ['Request changes', 'request-changes', 'game_accounts.reject', true],
    ['Suspend', 'suspend', 'game_accounts.suspend', true],
    ['Restore', 'restore', 'game_accounts.restore', false],
    ['Disconnect', 'disconnect', 'game_accounts.suspend', false],
  ];
  return (
    <div className="stack">
      <Link className="button secondary" href="/admin/game-accounts">
        Back to queue
      </Link>
      {error ? (
        <Alert error>
          {error === 'conflict'
            ? 'This claim changed. Refresh before reviewing again.'
            : 'The review action failed.'}
        </Alert>
      ) : null}
      <Card>
        <div className="cluster">
          <h1>{account.displayHandle}</h1>
          <Badge>{presentStatus(account.status, locale)}</Badge>
        </div>
        <dl className="detail-list">
          <dt>Owner</dt>
          <dd className="ltr">{account.userId}</dd>
          <dt>Game</dt>
          <dd>{account.game.name}</dd>
          <dt>Platform</dt>
          <dd>{account.platform.name}</dd>
          <dt>Normalized identity</dt>
          <dd className="ltr">{account.normalizedHandle}</dd>
          <dt>Version</dt>
          <dd>{account.version}</dd>
        </dl>
      </Card>
      <div className="grid">
        {forms
          .filter(([, , permission]) => allowed(permission))
          .map(([label, operation, , requiresReason]) => (
            <Card key={operation}>
              <form
                className="form"
                onSubmit={(event) => {
                  if (!window.confirm(`Confirm ${label.toLowerCase()}?`)) {
                    event.preventDefault();
                    return;
                  }
                  void action(event, operation);
                }}
              >
                <h2>{label}</h2>
                {requiresReason ? (
                  <Field name={`${operation}-reason`} label="Reason code">
                    <Select id={`${operation}-reason`} name="reasonCode" required defaultValue="">
                      <option value="" disabled>
                        Select a reason
                      </option>
                      {(operation === 'suspend'
                        ? GAME_ACCOUNT_SUSPENSION_REASON_CODES
                        : GAME_ACCOUNT_REJECTION_REASON_CODES
                      ).map((value) => (
                        <option key={value} value={value}>
                          {presentReason(value, locale)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field name={`${operation}-message`} label="Message visible to user">
                  <Input id={`${operation}-message`} name="userMessage" maxLength={500} />
                </Field>
                <Field name={`${operation}-note`} label="Internal note">
                  <Input id={`${operation}-note`} name="note" maxLength={500} />
                </Field>
                <Button disabled={pending} type="submit">
                  {pending ? 'Working…' : label}
                </Button>
              </form>
            </Card>
          ))}
      </div>
      <Card>
        <h2>Audit history</h2>
        {reviews.length === 0 ? (
          <p className="muted">No review history.</p>
        ) : (
          <ol className="timeline">
            {reviews.map((review) => (
              <li key={review.id}>
                <strong>{presentAction(review.action, locale)}</strong>
                <span>{presentReason(review.reasonCode, locale)}</span>
                <time dateTime={review.createdAt}>
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(review.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
