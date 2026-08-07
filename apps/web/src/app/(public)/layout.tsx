import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/shells';
import { getServerLocale } from '@/i18n/server';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  return (
    <PublicShell locale={locale}>
      <main id="main-content" className="container page">
        {children}
      </main>
    </PublicShell>
  );
}
