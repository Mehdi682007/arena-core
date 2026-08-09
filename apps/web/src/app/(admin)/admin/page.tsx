import Link from 'next/link';
import { Alert } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';
import { adminApi } from '@/features/admin/api';
import { ADMIN_PREVIEW_PERMISSIONS, isAdminUiPreviewEnabled } from '@/features/admin/preview';
import type { AdminPermission, Diagnostics } from '@/features/admin/types';
import type { AppLocale } from '@/i18n/config';
import { getRequestLocale } from '@/i18n/server';
import { uiMessagesFor } from '@/i18n/ui-messages';

type DashboardLink = {
  permission: AdminPermission;
  href: string;
  title: string;
  description: string;
  symbol: string;
};

const shortcutsFor = (locale: AppLocale): readonly DashboardLink[] => {
  const ui = uiMessagesFor(locale);
  return [
    {
      permission: 'match_disputes.read',
      href: '/admin/disputes',
      title: ui.disputeQueue,
      description: ui.casesRequiringHumanReviewAndAnOperational,
      symbol: '⚖',
    },
    {
      permission: 'match_results.read',
      href: '/admin/results',
      title: ui.resultConflicts,
      description: ui.conflictingSubmissionsAndRelatedMatchEvidence,
      symbol: '≠',
    },
    {
      permission: 'notifications.read',
      href: '/admin/notifications/outbox',
      title: ui.notificationQueue,
      description: ui.deliveryStatusRetriesAndStoppedMessages,
      symbol: '✦',
    },
    {
      permission: 'audit.read',
      href: '/admin/audit',
      title: ui.operationsAudit,
      description: ui.aTrailOfSensitiveChangesAndRecorded,
      symbol: '≣',
    },
    {
      permission: 'matches.read',
      href: '/admin/matches',
      title: ui.competitions,
      description: ui.matchStatusParticipantsAndOperationalTimeline,
      symbol: '⚔',
    },
    {
      permission: 'wallets.read',
      href: '/admin/wallets',
      title: ui.wallet,
      description: ui.operationalViewOfUserBalancesAndLedger,
      symbol: '◈',
    },
  ];
};

const formatUptime = (seconds: number, locale: AppLocale) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const value = days > 0 ? days : hours > 0 ? hours : minutes;
  const unit = days > 0 ? 'day' : hours > 0 ? 'hour' : 'minute';
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    style: 'unit',
    unit,
    unitDisplay: 'long',
  }).format(value);
};

async function loadDiagnostics(permissions: Set<AdminPermission>): Promise<Diagnostics | null> {
  if (!permissions.has('diagnostics.read')) {
    return null;
  }

  try {
    return await adminApi.diagnostics();
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const shortcuts = shortcutsFor(locale);
  const preview = isAdminUiPreviewEnabled();
  const access = preview ? null : await getAdminAccess();

  if (!preview && access?.status !== 'allowed') {
    return <Alert error>{ui.managementFeaturesAreNotAvailable}</Alert>;
  }

  const permissions =
    access?.status === 'allowed' ? access.permissions : [...ADMIN_PREVIEW_PERMISSIONS];

  const allowed = new Set(permissions);
  const diagnostics = preview ? null : await loadDiagnostics(allowed);

  const dependencyEntries = diagnostics ? Object.entries(diagnostics.dependencies) : [];

  const healthyDependencies = dependencyEntries.filter(
    ([, status]) =>
      status === 'up' || status === 'ok' || status === 'configured' || status === 'disabled',
  ).length;

  return (
    <div className="admin-dashboard stack">
      {preview ? <Alert>{ui.thePreviewModeOfTheManagementInterface}</Alert> : null}

      <section className="admin-dashboard-hero">
        <div>
          <span className="admin-console-eyebrow">Operational command center</span>

          <h1>{ui.arenaCoreOperationsCenter}</h1>

          <p>{ui.centralizedViewForServiceMonitoringHandlingOperational}</p>
        </div>

        <div className="admin-dashboard-hero-status">
          <span aria-hidden="true" />

          <div>
            <strong>
              {preview
                ? ui.developmentPreviewMode
                : diagnostics?.shuttingDown
                  ? ui.theServiceIsStopping
                  : diagnostics
                    ? ui.theServiceIsActive
                    : ui.serviceStatusIsUnavailable}
            </strong>

            <small>
              {preview
                ? ui.theLocalApiIsNotConnected
                : diagnostics
                  ? `${diagnostics.service} · ${diagnostics.environment}`
                  : ui.diagnosticsInformationWasNotReceived}
            </small>
          </div>
        </div>
      </section>

      <section className="admin-metric-grid" aria-label={ui.operationalIndicators}>
        <article className="admin-metric-card">
          <span>{ui.activeAccess}</span>

          <strong>{new Intl.NumberFormat('fa').format(permissions.length)}</strong>

          <small>{ui.enabledFeatureForCurrentAccount}</small>
        </article>

        <article className="admin-metric-card">
          <span>{ui.theHealthOfDependencies}</span>

          <strong>
            {diagnostics
              ? `${new Intl.NumberFormat('fa').format(
                  healthyDependencies,
                )} / ${new Intl.NumberFormat('fa').format(dependencyEntries.length)}`
              : '—'}
          </strong>

          <small>{ui.basedOnTheDiagnosticsServiceApi}</small>
        </article>

        <article className="admin-metric-card">
          <span>{ui.apiActivityTime}</span>

          <strong>{diagnostics ? formatUptime(diagnostics.uptimeSeconds, locale) : '—'}</strong>

          <small>{ui.sinceTheLastLaunchOfTheService}</small>
        </article>

        <article className="admin-metric-card">
          <span>{ui.operationalVersion}</span>

          <strong className="ltr admin-metric-version">{diagnostics?.version ?? 'Preview'}</strong>

          <small className="ltr">
            {diagnostics?.buildSha ? diagnostics.buildSha.slice(0, 12) : 'Live build unavailable'}
          </small>
        </article>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-section-heading">
          <div>
            <span className="admin-console-eyebrow">Quick access</span>
            <h2>{ui.mainQueuesAndTools}</h2>
          </div>

          <Link href="/admin/search">{ui.advancedSearch}</Link>
        </div>

        <div className="admin-shortcut-grid">
          {shortcuts
            .filter((item) => allowed.has(item.permission))
            .map((item) => (
              <Link className="admin-shortcut-card" href={item.href} key={item.href}>
                <span className="admin-shortcut-symbol" aria-hidden="true">
                  {item.symbol}
                </span>

                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>

                <span className="admin-shortcut-arrow" aria-hidden="true">
                  ←
                </span>
              </Link>
            ))}
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-dashboard-panel">
          <div className="admin-section-heading">
            <div>
              <span className="admin-console-eyebrow">Dependencies</span>

              <h2>{ui.serviceDependencies}</h2>
            </div>

            {allowed.has('diagnostics.read') ? (
              <Link href="/admin/diagnostics">{ui.details}</Link>
            ) : null}
          </div>

          {dependencyEntries.length > 0 ? (
            <dl className="admin-dependency-list">
              {dependencyEntries.map(([name, status]) => (
                <div key={name}>
                  <dt className="ltr">{name}</dt>

                  <dd>
                    <span className={`admin-status-chip admin-status-${status.toLowerCase()}`}>
                      {status}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">
              {preview
                ? ui.dependenciesLiveDataIsNotDisplayedIn
                : ui.dependenciesInformationIsNotAvailableAtThis}
            </p>
          )}
        </article>

        <article className="admin-dashboard-panel admin-security-panel">
          <div>
            <span className="admin-console-eyebrow">Security boundary</span>

            <h2>{ui.controlSensitiveOperations}</h2>
          </div>

          <ul>
            <li>{ui.allSensitiveOperationsAreReauthorizedInThe}</li>

            <li>{ui.modifierOperationsAreExecutedWithAuditLogging}</li>

            <li>{ui.previewModeIsActivatedOnlyInNon}</li>
          </ul>

          {allowed.has('audit.read') ? (
            <Link className="button secondary" href="/admin/audit">
              {ui.viewAuditEvents}
            </Link>
          ) : null}
        </article>
      </section>
    </div>
  );
}
