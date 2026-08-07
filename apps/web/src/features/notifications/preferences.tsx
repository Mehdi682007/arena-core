'use client';
import { useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { browserApi } from '@/lib/api/browser-api-client';
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
  const labels =
    locale === 'fa'
      ? {
          saved: 'ترجیحات ذخیره شد.',
          failed: 'ذخیره ترجیحات ممکن نشد.',
          inApp: 'درون‌برنامه‌ای',
          email: 'ایمیل',
          save: 'ذخیره',
        }
      : {
          saved: 'Preferences saved.',
          failed: 'Could not save preferences.',
          inApp: 'In-app',
          email: 'Email',
          save: 'Save',
        };
  async function save(item: Preference) {
    setMessage('');
    try {
      const updated = await browserApi<Preference>(
        `/notification-preferences/${encodeURIComponent(item.type)}`,
        {
          method: 'PUT',
          body: { inAppEnabled: item.inAppEnabled, emailEnabled: item.emailEnabled },
        },
      );
      setItems((all) => all.map((value) => (value.type === item.type ? updated : value)));
      setMessage(labels.saved);
    } catch {
      setMessage(labels.failed);
    }
  }
  return (
    <div className="stack">
      {message ? <Alert>{message}</Alert> : null}
      {items.map((item) => (
        <Card key={item.type}>
          <strong className="ltr">{item.type}</strong>
          <label className="cluster">
            <input
              type="checkbox"
              checked={item.inAppEnabled}
              disabled={item.requiredChannels.includes('IN_APP')}
              onChange={(event) =>
                setItems((all) =>
                  all.map((value) =>
                    value.type === item.type
                      ? { ...value, inAppEnabled: event.target.checked }
                      : value,
                  ),
                )
              }
            />{' '}
            {labels.inApp}
          </label>
          <label className="cluster">
            <input
              type="checkbox"
              checked={item.emailEnabled}
              disabled={item.requiredChannels.includes('EMAIL')}
              onChange={(event) =>
                setItems((all) =>
                  all.map((value) =>
                    value.type === item.type
                      ? { ...value, emailEnabled: event.target.checked }
                      : value,
                  ),
                )
              }
            />{' '}
            {labels.email}
          </label>
          <Button className="secondary" onClick={() => void save(item)}>
            {labels.save}
          </Button>
        </Card>
      ))}
    </div>
  );
}
