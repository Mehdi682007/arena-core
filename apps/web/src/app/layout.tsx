import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import '@fontsource-variable/vazirmatn';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { localeDirection } from '@/i18n/config';
import { LocaleProvider } from '@/i18n/ui-messages-client';
import { serverApi } from '@/lib/api/server-api-client';
import '../styles/globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const settings = await serverApi<{
    brand: {
      siteName: Record<'fa' | 'en', string>;
      description: Record<'fa' | 'en', string>;
      faviconUrl: string;
      openGraphImageUrl: string;
    };
  }>('/site-settings').catch(() => null);
  const name = settings?.brand.siteName[locale] || 'Arena Core';
  const description =
    settings?.brand.description[locale] || ui.aTransparentNonMonetaryOnlineCompetitionPlatform;
  return {
    title: { default: name, template: `%s | ${name}` },
    description,
    icons: settings?.brand.faviconUrl ? { icon: settings.brand.faviconUrl } : undefined,
    openGraph: {
      title: name,
      description,
      ...(settings?.brand.openGraphImageUrl ? { images: [settings.brand.openGraphImageUrl] } : {}),
    },
  };
}

const themeBootstrap = `(function(){try{var k='arena-theme';var p=localStorage.getItem(k);if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.dataset.theme=d?'dark':'light';e.dataset.themePreference=p;e.style.colorScheme=d?'dark':'light'}catch(_){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          {ui.skipToMainContent}
        </a>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
