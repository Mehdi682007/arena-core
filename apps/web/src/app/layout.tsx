import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Arena Core', template: '%s | Arena Core' },
  description: 'بستر رقابت آنلاین شفاف و غیرمالی',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <a className="skip-link" href="#main-content">
          پرش به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  );
}
