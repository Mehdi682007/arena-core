'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import { notificationMatchHref } from '@/features/competition/presentation';
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
}: {
  initialItems: readonly NotificationItem[];
  nextCursor: string | null;
}) {
  const ui = useUiMessages();
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
      <EmptyState title={ui.youHaveNoNotification}>
        <p>{ui.newNotificationsWillBeDisplayedHere}</p>
      </EmptyState>
    );
  return (
    <div className="stack">
      {error ? <Alert error>{ui.couldNotUpdateNotification}</Alert> : null}
      {items.map((item) => (
        <Card key={item.id}>
          <div className="cluster">
            {notificationMatchHref(item.type, item.data) ? (
              <Link href={notificationMatchHref(item.type, item.data) ?? '/notifications'}>
                {ui.viewTheRace}
              </Link>
            ) : null}
            <h2>{item.subject}</h2>
            {!item.read ? <Badge>{ui.new}</Badge> : null}
          </div>
          <p>{item.body}</p>
          <time dateTime={item.createdAt}>
            {new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(item.createdAt),
            )}
          </time>
          <div className="cluster">
            <Button
              className="secondary"
              onClick={() => action(item.id, item.read ? 'unread' : 'read')}
            >
              {ui.unread}
            </Button>
            <Button className="secondary" onClick={() => action(item.id, 'archive')}>
              {ui.archive}
            </Button>
          </div>
        </Card>
      ))}
      {cursor ? (
        <Button className="secondary" onClick={more}>
          {ui.showMore}
        </Button>
      ) : null}
    </div>
  );
}
