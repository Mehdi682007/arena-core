'use client';
import { FormEvent, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';

const sourceTypes = [
  'MATCHMAKING_PROPOSAL',
  'MATCH',
  'MATCH_RESULT',
  'MATCH_DISPUTE',
  'MATCH_SETTLEMENT',
  'RATING_APPLICATION',
] as const;
export function RecoveryForm() {
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  return (
    <form
      className="form card"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const sourceType = String(data.get('sourceType'));
        const sourceId = String(data.get('sourceId'));
        if (
          !sourceTypes.includes(sourceType as (typeof sourceTypes)[number]) ||
          !/^[0-9a-f-]{36}$/i.test(sourceId)
        ) {
          setState('error');
          return;
        }
        void (async () => {
          setState('pending');
          try {
            await browserApi('/admin/notifications/recovery/sources', {
              method: 'POST',
              body: { sourceType, sourceId },
            });
            setState('done');
          } catch {
            setState('error');
          }
        })();
      }}
    >
      <h2>بازیابی اعلان‌های منبع</h2>
      <Field name="sourceType" label="نوع منبع">
        <Select id="sourceType" name="sourceType">
          {sourceTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Select>
      </Field>
      <Field name="sourceId" label="شناسه منبع">
        <Input className="ltr" id="sourceId" name="sourceId" required pattern="[0-9a-fA-F-]{36}" />
      </Field>
      <Button disabled={state === 'pending'}>
        {state === 'pending' ? 'در حال بازیابی…' : 'تأیید و بازیابی'}
      </Button>
      {state === 'done' ? <Alert>درخواست بازیابی توسط سرور تأیید شد.</Alert> : null}
      {state === 'error' ? <Alert error>بازیابی انجام نشد.</Alert> : null}
    </form>
  );
}
