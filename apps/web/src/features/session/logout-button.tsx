'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { browserApi } from '@/lib/api/browser-api-client';

export function LogoutButton({ locale = 'fa' }: { locale?: AppLocale }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const messages = messagesFor(locale).security;

  async function logout(): Promise<void> {
    setPending(true);

    try {
      await browserApi('/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Button
      className="danger"
      disabled={pending}
      onClick={() => {
        void logout();
      }}
    >
      {pending ? messages.loggingOut : messages.logout}
    </Button>
  );
}
