'use client';
import { useRef, type ReactNode } from 'react';
import { Button } from './index';
export function Dialog({
  trigger,
  title,
  children,
}: {
  trigger: string;
  title: string;
  children: ReactNode;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button className="secondary" onClick={() => reference.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={reference}
        aria-labelledby="dialog-title"
        onCancel={() => reference.current?.close()}
      >
        <h2 id="dialog-title">{title}</h2>
        {children}
        <form method="dialog">
          <Button>بستن</Button>
        </form>
      </dialog>
    </>
  );
}
