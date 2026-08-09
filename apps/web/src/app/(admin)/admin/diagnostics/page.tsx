import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { Card } from '@/components/ui';
import { adminApi } from '@/features/admin/api';
import { requireAdminPermission } from '@/features/admin/access';
export default async function DiagnosticsPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('diagnostics.read');
  const item = await adminApi.diagnostics();
  return (
    <div className="stack">
      <div className="cluster">
        <h1>{ui.serviceStatus}</h1>
        <a className="button secondary" href="/admin/diagnostics">
          {ui.manualRefresh}
        </a>
      </div>
      <Card>
        <dl className="admin-details">
          <dt>{ui.service}</dt>
          <dd>{item.service}</dd>
          <dt>{ui.version}</dt>
          <dd>{item.version}</dd>
          <dt>{ui.theEnvironment}</dt>
          <dd>{item.environment}</dd>
          <dt>Build SHA</dt>
          <dd className="ltr">{item.buildSha}</dd>
          <dt>Uptime</dt>
          <dd>
            {new Intl.NumberFormat('fa').format(item.uptimeSeconds)} {ui.seconds}
          </dd>
          <dt>Migration mode</dt>
          <dd>{item.migrationMode}</dd>
          <dt>{ui.stopping}</dt>
          <dd>{ui.yes}</dd>
        </dl>
      </Card>
      <Card>
        <h2>{ui.dependencies}</h2>
        {Object.entries(item.dependencies).map(([name, status]) => (
          <p key={name}>
            {name}: <b>{status}</b>
          </p>
        ))}
      </Card>
    </div>
  );
}
