import { Alert, Card, EmptyState } from '@/components/ui';
import { adminApi } from './api';
import { SafeJson } from './components';
import { adminDictionaries, type AdminItemKey } from '@/i18n/admin-dictionary';
import { getRequestLocale } from '@/i18n/server';

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
  itemKey,
  endpoint,
}: {
  itemKey: AdminItemKey;
  endpoint: string;
}) {
  const dictionary = adminDictionaries[await getRequestLocale()];
  const text = dictionary.items[itemKey];
  const data = await adminApi.resource(endpoint);
  return (
    <div className="stack">
      <div>
        <h1>{text.label}</h1>
        <p className="muted">{text.description}</p>
      </div>
      <Alert>{dictionary.common.authorizedApiNotice}</Alert>
      {rows(data).length === 0 ? (
        <EmptyState title={dictionary.common.noDisplayData} />
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
