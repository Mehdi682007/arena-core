'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';

export function AdminAction({
  path,
  label,
  description,
  body = {},
}: {
  path: string;
  label: string;
  description: string;
  body?: unknown;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const router = useRouter();
  return (
    <div>
      <Button onClick={() => dialog.current?.showModal()}>{label}</Button>
      <dialog ref={dialog} aria-labelledby="admin-confirm-title">
        <div className="stack">
          <h2 id="admin-confirm-title">تأیید عملیات</h2>
          <p>{description}</p>
          {state === 'done' ? <Alert>عملیات توسط سرور تأیید شد.</Alert> : null}
          {state === 'error' ? (
            <Alert error>عملیات انجام نشد؛ وضعیت را تازه‌سازی کنید.</Alert>
          ) : null}
          <div className="cluster">
            <Button
              disabled={state === 'pending'}
              onClick={() => {
                void (async () => {
                  setState('pending');
                  try {
                    await browserApi(path, { method: 'POST', body });
                    setState('done');
                    router.refresh();
                  } catch {
                    setState('error');
                  }
                })();
              }}
            >
              {state === 'pending' ? 'در حال انجام…' : 'تأیید'}
            </Button>
            <Button className="secondary" onClick={() => dialog.current?.close()}>
              بستن
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
