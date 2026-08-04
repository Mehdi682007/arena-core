import '@fontsource-variable/vazirmatn';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { localeCookieName, localeDirection, normalizeLocale } from '@/i18n/config';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Arena Core', template: '%s | Arena Core' },
  description: 'بستر رقابت آنلاین شفاف و غیرمالی',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value);

  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <body>
        <a className="skip-link" href="#main-content">
          {locale === 'fa' ? 'پرش به محتوای اصلی' : 'Skip to main content'}
        </a>
        {children}
      </body>
    </html>
  );
}
