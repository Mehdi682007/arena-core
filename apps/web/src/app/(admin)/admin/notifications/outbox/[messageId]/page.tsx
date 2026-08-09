import { uiMessagesFor } from '@/i18n/ui-messages';
import { presentStatus } from '@/i18n/presentation';
import { notificationPresentation } from '@/features/notifications/notification-presentation';
import { getRequestLocale } from '@/i18n/server';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { AdminAction } from '@/features/admin/admin-action';
import { adminApi } from '@/features/admin/api';
import { requireAnyAdminPermission } from '@/features/admin/access';
export default async function OutboxDetail({ params }: { params: Promise<{ messageId: string }> }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const permissions = await requireAnyAdminPermission([
    'notifications.read',
    'notifications.retry',
  ]);
  const { messageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) notFound();
  const item = await adminApi.outboxDetail(messageId);
  const retryable = ['FAILED', 'DEAD_LETTERED', 'CANCELLED'].includes(item.status);
  return (
    <div className="stack">
      <h1>{ui.outboxMessageDetails}</h1>
      <Card>
        <Badge>{presentStatus(item.status, locale)}</Badge>
        <dl className="admin-details">
          <dt>{ui.type}</dt>
          <dd>{notificationPresentation(item.type, locale).title}</dd>
          <dt>{ui.channel}</dt>
          <dd>{item.channel}</dd>
          <dt>{ui.numberOfAttempts}</dt>
          <dd>{new Intl.NumberFormat('fa').format(item.attemptCount)}</dd>
          <dt>{ui.safeErrorCode}</dt>
          <dd>{item.lastErrorCode ?? '—'}</dd>
          <dt>{ui.accessTime}</dt>
          <dd>
            <time dateTime={item.availableAt}>
              {new Intl.DateTimeFormat('fa', { dateStyle: 'medium', timeStyle: 'medium' }).format(
                new Date(item.availableAt),
              )}
            </time>
          </dd>
        </dl>
      </Card>
      {retryable && permissions.includes('notifications.retry') ? (
        <AdminAction
          path={`/admin/notifications/outbox/${encodeURIComponent(item.id)}/retry`}
          label={ui.tryAgain}
          description={ui.thisOperationQueuesTheSubmissionAndDoes}
        />
      ) : null}
    </div>
  );
}
