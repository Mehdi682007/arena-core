import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { AdminAction } from '@/features/admin/admin-action';
import { adminApi } from '@/features/admin/api';
import { requireAnyAdminPermission } from '@/features/admin/access';
export default async function OutboxDetail({ params }: { params: Promise<{ messageId: string }> }) {
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
      <h1>جزئیات پیام Outbox</h1>
      <Card>
        <Badge>{item.status}</Badge>
        <dl className="admin-details">
          <dt>نوع</dt>
          <dd>{item.type}</dd>
          <dt>کانال</dt>
          <dd>{item.channel}</dd>
          <dt>تعداد تلاش</dt>
          <dd>{new Intl.NumberFormat('fa').format(item.attemptCount)}</dd>
          <dt>کد خطای امن</dt>
          <dd>{item.lastErrorCode ?? '—'}</dd>
          <dt>زمان دسترسی</dt>
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
          label="تلاش مجدد"
          description="این عملیات ارسال را در صف قرار می‌دهد و موفقیت تحویل را تضمین نمی‌کند."
        />
      ) : null}
    </div>
  );
}
