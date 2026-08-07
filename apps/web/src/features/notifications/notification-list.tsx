'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import { notificationMatchHref } from '@/features/competition/presentation';
import type { AppLocale } from '@/i18n/config';
import { productMessagesFor } from '@/i18n/product-messages';
import { browserApi } from '@/lib/api/browser-api-client';

export interface NotificationItem {
  id: string;
  type: string;
  priority: string;
  subject: string;
  body: string;
  data: Readonly<Record<string, unknown>>;
  read: boolean;
  archived: boolean;
  createdAt: string;
}

export function NotificationList({
  initialItems,
  nextCursor,
  locale,
}: {
  initialItems: readonly NotificationItem[];
  nextCursor: string | null;
  locale: AppLocale;
}) {
  const messages = productMessagesFor(locale).notifications;
  const [items, setItems] = useState([...initialItems]);
  const [cursor, setCursor] = useState(nextCursor);
  const [error, setError] = useState(false);

  async function action(id: string, operation: 'read' | 'unread' | 'archive') {
    setError(false);
    try {
      const updated = await browserApi<NotificationItem>(
        `/notifications/${encodeURIComponent(id)}/${operation}`,
        { method: 'POST' },
      );
      setItems((current) =>
        operation === 'archive'
          ? current.filter((item) => item.id !== id)
          : current.map((item) => (item.id === id ? updated : item)),
      );
    } catch {
      setError(true);
    }
  }

  async function more() {
    if (!cursor) return;
    try {
      const page = await browserApi<{ items: NotificationItem[]; nextCursor: string | null }>(
        `/notifications?limit=20&cursor=${encodeURIComponent(cursor)}`,
      );
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    }
  }

  if (items.length === 0)
    return (
      <EmptyState title={messages.empty}>
        <p>{messages.emptyDescription}</p>
      </EmptyState>
    );

  return (
    <div className="stack">
      {error ? <Alert error>{messages.updateFailed}</Alert> : null}
      {items.map((item) => {
        const matchHref = notificationMatchHref(item.type, item.data);
        return (
          <Card key={item.id}>
            <div className="cluster">
              {matchHref ? <Link href={matchHref}>{messages.viewMatchFlow}</Link> : null}
              <h2>{item.subject}</h2>
              {!item.read ? <Badge>{messages.new}</Badge> : null}
            </div>
            <p>{item.body}</p>
            <time dateTime={item.createdAt}>
              {new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(item.createdAt))}
            </time>
            <div className="cluster">
              <Button
                className="secondary"
                onClick={() => action(item.id, item.read ? 'unread' : 'read')}
              >
                {item.read ? messages.markUnread : messages.markRead}
              </Button>
              <Button className="secondary" onClick={() => action(item.id, 'archive')}>
                {messages.archive}
              </Button>
            </div>
          </Card>
        );
      })}
      {cursor ? (
        <Button className="secondary" onClick={more}>
          {messages.more}
        </Button>
      ) : null}
    </div>
  );
}
