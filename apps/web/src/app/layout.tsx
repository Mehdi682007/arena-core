import '@fontsource-variable/vazirmatn';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { localeDirection } from '@/i18n/config';
import { getServerLocale } from '@/i18n/server';
import '../styles/globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title: { default: 'Arena Core', template: '%s | Arena Core' },
    description:
      locale === 'fa'
        ? 'بستر رقابت آنلاین شفاف و غیرمالی'
        : 'A transparent, non-financial platform for online competition',
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getServerLocale();

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
