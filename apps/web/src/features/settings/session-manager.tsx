'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { rc4MessagesFor } from '@/i18n/rc4-messages';
import { browserApi } from '@/lib/api/browser-api-client';

export interface UserSessionView {
  readonly id: string;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly current: boolean;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly expiresAt: string;
  readonly userAgent: string | null;
}

function deviceName(userAgent: string | null, fallback: string): string {
  if (!userAgent) {
    return fallback;
  }

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null;

  const platform = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;

  const friendly = [browser, platform].filter(Boolean).join(' · ');

  return friendly || userAgent.slice(0, 120);
}

export function SessionManager({
  initial,
  locale,
}: {
  initial: readonly UserSessionView[];
  locale: AppLocale;
}) {
  const router = useRouter();
  const text = rc4MessagesFor(locale).sessionManager;

  const [items, setItems] = useState([...initial]);
  const [pendingId, setPendingId] = useState<string>();
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [error, setError] = useState(false);

  const formatter = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  async function revoke(session: UserSessionView): Promise<void> {
    setPendingId(session.id);
    setError(false);

    try {
      await browserApi(`/auth/sessions/${encodeURIComponent(session.id)}/revoke`, {
        method: 'POST',
      });

      if (session.current) {
        router.replace('/login');
        router.refresh();
        return;
      }

      setItems((all) => all.filter((item) => item.id !== session.id));
    } catch {
      setError(true);
    } finally {
      setPendingId(undefined);
    }
  }

  async function revokeOthers(): Promise<void> {
    setRevokingOthers(true);
    setError(false);

    try {
      await browserApi('/auth/sessions/revoke-others', {
        method: 'POST',
      });

      setItems((all) => all.filter((item) => item.current));
    } catch {
      setError(true);
    } finally {
      setRevokingOthers(false);
    }
  }

  return (
    <div className="stack">
      {error ? <Alert error>{text.failed}</Alert> : null}

      {items.map((session) => (
        <Card key={session.id}>
          <div className="cluster">
            <strong>{deviceName(session.userAgent, text.unknownDevice)}</strong>

            {session.current ? <Badge>{text.current}</Badge> : null}
          </div>

          <p className="muted">
            {text.created}: {formatter.format(new Date(session.createdAt))}
          </p>

          <p className="muted">
            {text.lastActive}: {formatter.format(new Date(session.lastSeenAt ?? session.createdAt))}
          </p>

          <p className="muted">
            {text.expires}: {formatter.format(new Date(session.expiresAt))}
          </p>

          <Button
            className={session.current ? 'danger' : 'secondary'}
            disabled={pendingId !== undefined || revokingOthers}
            onClick={() => {
              void revoke(session);
            }}
          >
            {pendingId === session.id ? text.revoking : text.revoke}
          </Button>
        </Card>
      ))}

      {items.filter((item) => !item.current).length === 0 ? (
        <p className="muted">{text.empty}</p>
      ) : (
        <Button
          className="danger"
          disabled={pendingId !== undefined || revokingOthers}
          onClick={() => {
            void revokeOthers();
          }}
        >
          {revokingOthers ? text.revokingOthers : text.revokeOthers}
        </Button>
      )}
    </div>
  );
}
