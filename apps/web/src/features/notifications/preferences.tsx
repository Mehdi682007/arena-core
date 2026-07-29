'use client';
import { useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
interface Preference {
  type: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  requiredChannels: readonly ('IN_APP' | 'EMAIL')[];
}
export function NotificationPreferences({ initial }: { initial: readonly Preference[] }) {
  const [items, setItems] = useState([...initial]);
  const [message, setMessage] = useState('');
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
      setMessage('ترجیحات ذخیره شد.');
    } catch {
      setMessage('ذخیره ترجیحات ممکن نشد.');
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
            درون‌برنامه‌ای
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
            ایمیل
          </label>
          <Button className="secondary" onClick={() => save(item)}>
            ذخیره
          </Button>
        </Card>
      ))}
    </div>
  );
}
