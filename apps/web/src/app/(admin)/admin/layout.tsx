import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';
import { AdminOperationsShell } from '@/features/admin/admin-shell';
import { ADMIN_PREVIEW_PERMISSIONS, isAdminUiPreviewEnabled } from '@/features/admin/preview';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';

export const dynamic = 'force-dynamic';

type Localized = Readonly<{ fa: string; en: string }>;
type BrandSettings = Readonly<{ brand: Readonly<{ siteName: Localized }> }>;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const settings = await serverApi<BrandSettings>('/site-settings').catch(() => null);
  const siteName = settings?.brand.siteName[locale] || 'Arena Core';

  if (isAdminUiPreviewEnabled()) {
    return (
      <AdminOperationsShell
        locale={locale}
        permissions={[...ADMIN_PREVIEW_PERMISSIONS]}
        siteName={siteName}
      >
        {children}
      </AdminOperationsShell>
    );
  }

  const session = await getSession();

  if (session.status === 'unauthenticated') {
    redirect('/login?returnTo=%2Fadmin');
  }

  if (session.status !== 'authenticated') {
    return (
      <main className="container page">
        <Alert error>{ui.itWasNotPossibleToReceiveInformation}</Alert>
      </main>
    );
  }

  const access = await getAdminAccess();
  const publicBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

  if (access.status === 'mfa-required') {
    return (
      <main className="container page stack">
        <Alert error>{ui.toAccessManagementFirstEnableAndVerify}</Alert>

        <a className="button" href={`${publicBaseUrl}/settings/security/mfa`}>
          {ui.setUpTwoStepAuthentication}
        </a>
      </main>
    );
  }

  if (access.status === 'forbidden') {
    return (
      <main className="container page stack">
        <Alert error>{ui.yourAccountDoesNotHavePermissionTo}</Alert>

        <a className="button secondary" href={publicBaseUrl || '/'}>
          {ui.backToTheProgram}
        </a>
      </main>
    );
  }

  if (access.status !== 'allowed') {
    return (
      <main className="container page">
        <Alert error>{ui.itWasNotPossibleToReceiveInformation}</Alert>
      </main>
    );
  }

  return (
    <AdminOperationsShell locale={locale} permissions={access.permissions} siteName={siteName}>
      {children}
    </AdminOperationsShell>
  );
}
