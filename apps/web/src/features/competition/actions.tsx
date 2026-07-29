'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function CompetitionAction({
  path,
  label,
  redirectTo,
  danger = false,
}: {
  path: string;
  label: string;
  redirectTo?: string;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  return (
    <div>
      {error ? <Alert error>عملیات انجام نشد؛ وضعیت را تازه‌سازی کنید.</Alert> : null}
      <Button
        className={danger ? 'danger' : ''}
        disabled={pending}
        onClick={() => {
          void (async () => {
            setPending(true);
            setError(false);
            try {
              await browserApi(path, { method: 'POST', body: {} });
              if (redirectTo) router.replace(redirectTo);
              router.refresh();
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        {pending ? 'در حال انجام…' : label}
      </Button>
    </div>
  );
}
