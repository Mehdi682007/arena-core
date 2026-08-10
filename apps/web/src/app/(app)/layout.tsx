import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/shells';
import { ErrorState } from '@/components/ui';
import { getSession } from '@/features/session/session';
import { serverApi } from '@/lib/api/server-api-client';
import { resolveSiteAssetUrl } from '@/lib/site-asset-url';

type Localized = Readonly<{ fa: string; en: string }>;
type BrandSettings = Readonly<{
  brand: Readonly<{
    siteName: Localized;
    logoLight: { url: string; alt: Localized };
    logoDark: { url: string; alt: Localized };
  }>;
}>;

export const dynamic = 'force-dynamic';
export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.status === 'unauthenticated') redirect('/login');
  if (session.status === 'unavailable')
    return (
      <main className="container page">
        <ErrorState requestId={session.requestId} />
      </main>
    );
  const locale = session.user.locale;
  const unread = await serverApi<{ count: number }>('/notifications/unread-count').catch(() => ({
    count: 0,
  }));
  const settings = await serverApi<BrandSettings>('/site-settings').catch(() => null);
  const siteName = settings?.brand.siteName[locale];
  const branding = {
    name: siteName || 'Arena Core',
    ...(settings?.brand.logoLight.url
      ? {
          logoLight: {
            url: resolveSiteAssetUrl(settings.brand.logoLight.url),
            alt: siteName ?? '',
          },
        }
      : {}),
    ...(settings?.brand.logoDark.url
      ? { logoDark: { url: resolveSiteAssetUrl(settings.brand.logoDark.url), alt: siteName ?? '' } }
      : {}),
  };
  return (
    <AppShell user={session.user} unreadCount={unread.count} branding={branding}>
      {children}
    </AppShell>
  );
}
