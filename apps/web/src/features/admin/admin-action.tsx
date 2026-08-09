'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
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
  const ui = useUiMessages();
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const router = useRouter();
  return (
    <div>
      <Button onClick={() => dialog.current?.showModal()}>{label}</Button>
      <dialog ref={dialog} aria-labelledby="admin-confirm-title">
        <div className="stack">
          <h2 id="admin-confirm-title">{ui.confirmOperation}</h2>
          <p>{description}</p>
          {state === 'done' ? <Alert>{ui.theOperationWasConfirmedByTheServer}</Alert> : null}
          {state === 'error' ? (
            <Alert error>{ui.theOperationWasNotPerformedRefreshThe}</Alert>
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
              {ui.inProgress}
            </Button>
            <Button className="secondary" onClick={() => dialog.current?.close()}>
              {ui.toClose}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
