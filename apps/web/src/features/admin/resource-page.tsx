import { Alert, Card, EmptyState } from '@/components/ui';
import { adminApi } from './api';
import { SafeJson } from './components';

const rows = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.rows)) return record.rows;
  }
  return value == null ? [] : [value];
};

export async function AdminResourcePage({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint: string;
}) {
  const data = await adminApi.resource(endpoint);
  return (
    <div className="stack">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <Alert>
        نمایش فقط از API مدیریتی مجوزسنجی‌شده انجام می‌شود؛ داده حساس پیش از نمایش پالایش می‌شود.
      </Alert>
      {rows(data).length === 0 ? (
        <EmptyState title="داده‌ای برای نمایش وجود ندارد" />
      ) : (
        <div className="grid">
          {rows(data).map((item, index) => (
            <Card key={index}>
              <SafeJson value={item} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
