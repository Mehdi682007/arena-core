import { getWebConfig } from '../../config';
import { buildWebHealth } from '../../service-health';
import { getRequestLocale } from '@/i18n/server';
import { presentStatus } from '@/i18n/presentation';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const locale = await getRequestLocale();
  const health = buildWebHealth(getWebConfig().runtime);

  return (
    <main style={{ margin: '0 auto', maxWidth: 720, padding: '4rem 1.5rem' }}>
      <h1>Service health</h1>
      <dl>
        <dt>Service name</dt>
        <dd>{health.service}</dd>
        <dt>Status</dt>
        <dd>{presentStatus(health.status, locale)}</dd>
        <dt>Environment</dt>
        <dd>{health.environment}</dd>
        <dt>Version</dt>
        <dd>{health.version}</dd>
        <dt>Timestamp</dt>
        <dd>{health.timestamp}</dd>
      </dl>
    </main>
  );
}
