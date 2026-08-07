'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

export interface UserSessionItem {
  readonly id: string;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly current: boolean;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly userAgent: string | null;
}

function dateTime(value: string | null, locale: AppLocale): string {
  if (value === null) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function SessionsPanel({
  initial,
  locale,
}: {
  initial: readonly UserSessionItem[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const messages = messagesFor(locale).settings.sessions;
  const [sessions, setSessions] = useState<readonly UserSessionItem[]>(initial);
  const [pendingId, setPendingId] = useState<string>();
  const [allPending, setAllPending] = useState(false);
  const [error, setError] = useState<ApiError>();

  const statusLabel = (status: UserSessionItem['status']) =>
    status === 'ACTIVE' ? messages.active : status === 'REVOKED' ? messages.revoked : messages.expired;

  async function revoke(session: UserSessionItem) {
    setPendingId(session.id);
    setError(undefined);
    try {
      await browserApi(`/auth/sessions/${session.id}/revoke`, { method: 'POST' });
      if (session.current) {
        router.replace('/login');
        router.refresh();
        return;
      }
      setSessions((current) =>
        current.map((item) =>
          item.id === session.id ? { ...item, status: 'REVOKED' as const } : item,
        ),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPendingId(undefined);
    }
  }

  async function revokeAll() {
    setAllPending(true);
    setError(undefined);
    try {
      await browserApi('/auth/logout-all', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
      setAllPending(false);
    }
  }

  return (
    <div className="stack">
      {error ? <Alert error>{error.message}</Alert> : null}

      <div>
        <Button type="button" className="secondary" disabled={allPending} onClick={() => void revokeAll()}>
          {messages.revokeAll}
        </Button>
      </div>

      {sessions.length === 0 ? <p className="muted">{messages.empty}</p> : null}

      {sessions.map((session) => (
        <Card key={session.id}>
          <div className="stack">
            <div className="cluster">
              <strong>{session.current ? messages.current : statusLabel(session.status)}</strong>
              <Badge>{statusLabel(session.status)}</Badge>
            </div>
            <div>
              <strong>{messages.device}: </strong>
              <span className="ltr">{session.userAgent ?? messages.unknownDevice}</span>
            </div>
            <div className="muted">
              {messages.lastSeen}: {dateTime(session.lastSeenAt, locale)}
            </div>
            <div className="muted">
              {messages.created}: {dateTime(session.createdAt, locale)}
            </div>
            <div className="muted">
              {messages.expires}: {dateTime(session.expiresAt, locale)}
            </div>
            {session.status === 'ACTIVE' ? (
              <div>
                <Button
                  type="button"
                  className="secondary"
                  disabled={pendingId === session.id || allPending}
                  onClick={() => void revoke(session)}
                >
                  {messages.revoke}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
