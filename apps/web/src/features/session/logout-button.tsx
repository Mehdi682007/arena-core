'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { browserApi } from '@/lib/api/browser-api-client';

export function LogoutButton({ locale = 'fa' }: { locale?: AppLocale }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <Button
      className="danger"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await browserApi('/auth/logout', { method: 'POST' });
        } finally {
          router.replace('/login');
          router.refresh();
        }
      }}
    >
      {pending
        ? locale === 'fa'
          ? 'در حال خروج…'
          : 'Signing out…'
        : locale === 'fa'
          ? 'خروج از حساب'
          : 'Sign out'}
    </Button>
  );
}
