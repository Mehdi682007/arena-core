import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
import { SafeJson } from '@/features/admin/components';

export default async function AuditDetail({ params }: { params: Promise<{ auditId: string }> }) {
  await requireAdminPermission('audit.read');
  const { auditId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(auditId)) notFound();
  const item = await adminApi.auditDetail(auditId);
  return (
    <div className="stack">
      <h1>جزئیات رویداد ممیزی</h1>
      <Card>
        <dl className="admin-details">
          <dt>عملیات</dt>
          <dd>{item.action}</dd>
          <dt>عامل</dt>
          <dd>{item.actorType}</dd>
          <dt>هدف</dt>
          <dd className="ltr">
            {item.targetType} / {item.targetId ?? '—'}
          </dd>
          <dt>منبع</dt>
          <dd>{item.source}</dd>
          <dt>زمان</dt>
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
        <h2>فراداده امن</h2>
        <SafeJson value={item.metadata} />
      </Card>
    </div>
  );
}
