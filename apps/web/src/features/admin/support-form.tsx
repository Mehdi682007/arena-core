'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
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
  const ui = useUiMessages();
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
      <h2>{ui.retrieveSourceNotifications}</h2>
      <Field name="sourceType" label={ui.sourceType}>
        <Select id="sourceType" name="sourceType">
          {sourceTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Select>
      </Field>
      <Field name="sourceId" label={ui.resourceId}>
        <Input className="ltr" id="sourceId" name="sourceId" required pattern="[0-9a-fA-F-]{36}" />
      </Field>
      <Button disabled={state === 'pending'}>{ui.recovering}</Button>
      {state === 'done' ? <Alert>{ui.theRecoveryRequestWasApprovedByThe}</Alert> : null}
      {state === 'error' ? <Alert error>{ui.recoveryFailed}</Alert> : null}
    </form>
  );
}
