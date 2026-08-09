'use client';

import { useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { browserApi } from '@/lib/api/browser-api-client';
import { notificationPresentation } from './notification-presentation';

interface Preference {
  type: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  requiredChannels: readonly ('IN_APP' | 'EMAIL')[];
}

export function NotificationPreferences({
  initial,
  locale = 'fa',
}: {
  initial: readonly Preference[];
  locale?: AppLocale;
}) {
  const [items, setItems] = useState([...initial]);
  const [message, setMessage] = useState('');

  const messages = messagesFor(locale).notificationPreferences;

  async function save(item: Preference): Promise<void> {
    setMessage('');

    try {
      const updated = await browserApi<Preference>(
        `/notification-preferences/${encodeURIComponent(item.type)}`,
        {
          method: 'PUT',
          body: {
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
        },
      );

      setItems((all) => all.map((value) => (value.type === item.type ? updated : value)));

      setMessage(messages.saved);
    } catch {
      setMessage(messages.failed);
    }
  }

  return (
    <div className="stack">
      {message ? <Alert>{message}</Alert> : null}

      {items.map((item) => {
        const presentation = notificationPresentation(item.type, locale);
        const required = !presentation.configurable || item.requiredChannels.length > 0;
        return (
          <Card key={item.type}>
            <strong>{presentation.title}</strong>
            <p className="muted">{presentation.description}</p>

            <label className="cluster">
              <input
                type="checkbox"
                checked={item.inAppEnabled}
                disabled={!presentation.configurable || item.requiredChannels.includes('IN_APP')}
                onChange={(event) => {
                  setItems((all) =>
                    all.map((value) =>
                      value.type === item.type
                        ? {
                            ...value,
                            inAppEnabled: event.target.checked,
                          }
                        : value,
                    ),
                  );
                }}
              />

              {messages.inApp}
            </label>

            <label className="cluster">
              <input
                type="checkbox"
                checked={item.emailEnabled}
                disabled={!presentation.configurable || item.requiredChannels.includes('EMAIL')}
                onChange={(event) => {
                  setItems((all) =>
                    all.map((value) =>
                      value.type === item.type
                        ? {
                            ...value,
                            emailEnabled: event.target.checked,
                          }
                        : value,
                    ),
                  );
                }}
              />

              {messages.email}
            </label>

            <Button
              className="secondary"
              disabled={required}
              onClick={() => {
                void save(item);
              }}
            >
              {messages.save}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
