'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function LogoutButton() {
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
      {pending ? 'در حال خروج…' : 'خروج از حساب'}
    </Button>
  );
}
