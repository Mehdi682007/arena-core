import { uiMessagesFor } from '@/i18n/ui-messages';
import { presentAction } from '@/i18n/presentation';
import { getRequestLocale } from '@/i18n/server';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { SafeJson } from '@/features/admin/components';

export default async function AuditDetail({ params }: { params: Promise<{ auditId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('audit.read');
  const { auditId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(auditId)) notFound();
  const item = await adminApi.auditDetail(auditId);
  return (
    <div className="stack">
      <h1>{ui.auditEventDetails}</h1>
      <Card>
        <dl className="admin-details">
          <dt>{ui.action}</dt>
          <dd>{presentAction(item.action, locale)}</dd>
          <dt>{ui.actor}</dt>
          <dd>{item.actorType}</dd>
          <dt>{ui.purpose}</dt>
          <dd className="ltr">
            {item.targetType} / {item.targetId ?? '—'}
          </dd>
          <dt>{ui.source}</dt>
          <dd>{item.source}</dd>
          <dt>{ui.time}</dt>
          <dd>
            <time dateTime={item.createdAt}>
              {new Intl.DateTimeFormat('fa', { dateStyle: 'full', timeStyle: 'medium' }).format(
                new Date(item.createdAt),
              )}
            </time>
          </dd>
        </dl>
      </Card>
      <Card>
        <h2>{ui.secureMetadata}</h2>
        <SafeJson value={item.metadata} />
      </Card>
    </div>
  );
}
