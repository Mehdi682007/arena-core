import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import Link from 'next/link';
import { Field, Input, Select } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { AdminTable, CursorNext } from '@/features/admin/components';
import { safeAdminHref } from '@/features/admin/privacy';

const actions = [
  'USER_STATUS_CHANGED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'GAME_ACCOUNT_VERIFIED',
  'GAME_ACCOUNT_REJECTED',
  'GAME_ACCOUNT_SUSPENDED',
  'MATCH_VOIDED',
  'RESULT_ADMIN_RESOLVED',
  'DISPUTE_RESOLVED',
  'WALLET_RECONCILIATION_STARTED',
  'WALLET_RECONCILIATION_COMPLETED',
  'NOTIFICATION_RETRY_REQUESTED',
  'NOTIFICATION_RECOVERY_STARTED',
  'RATING_RECONCILIATION_STARTED',
];
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('audit.read');
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    'actorUserId',
    'targetType',
    'targetId',
    'action',
    'createdFrom',
    'createdTo',
    'cursor',
  ]) {
    const value = params[key];
    if (typeof value === 'string' && value.length <= 1024) query.set(key, value);
  }
  query.set('limit', '50');
  const page = await adminApi.audit(`?${query.toString()}`);
  return (
    <div className="stack">
      <h1>{ui.auditEvents}</h1>
      <form className="admin-filter" method="get">
        <Field name="actorUserId" label={ui.actorId}>
          <Input
            id="actorUserId"
            name="actorUserId"
            defaultValue={typeof params.actorUserId === 'string' ? params.actorUserId : ''}
          />
        </Field>
        <Field name="targetType" label={ui.targetType}>
          <Input
            id="targetType"
            name="targetType"
            maxLength={64}
            defaultValue={typeof params.targetType === 'string' ? params.targetType : ''}
          />
        </Field>
        <Field name="targetId" label={ui.targetId}>
          <Input
            id="targetId"
            name="targetId"
            maxLength={128}
            defaultValue={typeof params.targetId === 'string' ? params.targetId : ''}
          />
        </Field>
        <Field name="action" label={ui.action}>
          <Select
            id="action"
            name="action"
            defaultValue={typeof params.action === 'string' ? params.action : ''}
          >
            <option value="">{ui.everyone}</option>
            {actions.map((action) => (
              <option key={action}>{action}</option>
            ))}
          </Select>
        </Field>
        <Field name="createdFrom" label={ui.fromHistory}>
          <Input id="createdFrom" name="createdFrom" type="datetime-local" />
        </Field>
        <Field name="createdTo" label={ui.toDate}>
          <Input id="createdTo" name="createdTo" type="datetime-local" />
        </Field>
        <button className="button">{ui.applyFilter}</button>
      </form>
      <AdminTable
        caption="Audit Log"
        headings={[ui.time, ui.actor, ui.action, ui.purpose, ui.source, ui.details]}
        rows={page.items.map((item) => [
          <time key="time" dateTime={item.createdAt}>
            {new Intl.DateTimeFormat('fa', { dateStyle: 'short', timeStyle: 'short' }).format(
              new Date(item.createdAt),
            )}
          </time>,
          item.actorType,
          item.action,
          `${item.targetType}${item.targetId ? ` — ${item.targetId}` : ''}`,
          item.source,
          <Link key="link" href={safeAdminHref('audit', item.id) ?? '/admin/audit'}>
            {ui.view}
          </Link>,
        ])}
      />
      <CursorNext href="/admin/audit" cursor={page.nextCursor} />
    </div>
  );
}
