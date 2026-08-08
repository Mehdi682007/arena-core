'use client';

import { useState, type SyntheticEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

function text(locale: AppLocale) {
  return rc4MessagesFor(locale).mfa.featuresAuthMfaLoginChallenge01;
}

export function MfaLoginChallenge({
  locale,
  challengeToken,
  onComplete,
  onCancel,
}: {
  locale: AppLocale;
  challengeToken: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
}) {
  const copy = text(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);
    const rawCode = data.get('code');

    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    try {
      await browserApi('/auth/mfa/challenge/confirm', {
        method: 'POST',
        body: {
          challengeToken,
          code,
        },
      });

      await onComplete();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <Field name="code" label={copy.codeLabel} error={error?.fieldErrors?.code}>
        <Input
          id="mfa-code"
          name="code"
          dir="ltr"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          required
          aria-invalid={Boolean(error?.fieldErrors?.code)}
        />
      </Field>

      <small>{copy.codeHint}</small>

      {error ? <Alert error>{error.message}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? copy.submitting : copy.submit}
      </Button>

      <Button type="button" disabled={pending} onClick={onCancel}>
        {copy.cancel}
      </Button>
    </form>
  );
}
