import { Card } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
export default async function DiagnosticsPage() {
  await requireAdminPermission('diagnostics.read');
  const item = await adminApi.diagnostics();
  return (
    <div className="stack">
      <div className="cluster">
        <h1>وضعیت سرویس</h1>
        <a className="button secondary" href="/admin/diagnostics">
          تازه‌سازی دستی
        </a>
      </div>
      <Card>
        <dl className="admin-details">
          <dt>سرویس</dt>
          <dd>{item.service}</dd>
          <dt>نسخه</dt>
          <dd>{item.version}</dd>
          <dt>محیط</dt>
          <dd>{item.environment}</dd>
          <dt>Build SHA</dt>
          <dd className="ltr">{item.buildSha}</dd>
          <dt>Uptime</dt>
          <dd>{new Intl.NumberFormat('fa').format(item.uptimeSeconds)} ثانیه</dd>
          <dt>Migration mode</dt>
          <dd>{item.migrationMode}</dd>
          <dt>در حال توقف</dt>
          <dd>{item.shuttingDown ? 'بله' : 'خیر'}</dd>
        </dl>
      </Card>
      <Card>
        <h2>وابستگی‌ها</h2>
        {Object.entries(item.dependencies).map(([name, status]) => (
          <p key={name}>
            {name}: <b>{status}</b>
          </p>
        ))}
      </Card>
    </div>
  );
}
