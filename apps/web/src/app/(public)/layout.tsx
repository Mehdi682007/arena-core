import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/shells';
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell>
      <main id="main-content" className="container page">
        {children}
      </main>
    </PublicShell>
  );
}
