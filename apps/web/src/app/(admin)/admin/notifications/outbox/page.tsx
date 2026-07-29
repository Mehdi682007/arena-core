import { Field, Select } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { CursorNext, OutboxTable } from '@/features/admin/components';
export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission('notifications.read');
  const params = await searchParams;
  const query = new URLSearchParams({ limit: '50' });
  for (const key of ['status', 'channel', 'type', 'attemptMin', 'cursor']) {
    const value = params[key];
    if (typeof value === 'string' && value.length <= 128) query.set(key, value);
  }
  const page = await adminApi.outbox(`?${query.toString()}`);
  return (
    <div className="stack">
      <h1>Notification Outbox</h1>
      <form className="admin-filter">
        <Field name="status" label="وضعیت">
          <Select
            id="status"
            name="status"
            defaultValue={typeof params.status === 'string' ? params.status : ''}
          >
            <option value="">همه</option>
            {[
              'PENDING',
              'PROCESSING',
              'DELIVERED',
              'RETRY_SCHEDULED',
              'FAILED',
              'DEAD_LETTERED',
              'CANCELLED',
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field name="channel" label="کانال">
          <Select
            id="channel"
            name="channel"
            defaultValue={typeof params.channel === 'string' ? params.channel : ''}
          >
            <option value="">همه</option>
            <option>IN_APP</option>
            <option>EMAIL</option>
          </Select>
        </Field>
        <button className="button">اعمال فیلتر</button>
      </form>
      <OutboxTable items={page.items} />
      <CursorNext href="/admin/notifications/outbox" cursor={page.nextCursor} />
    </div>
  );
}
