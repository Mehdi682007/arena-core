'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, PasswordInput } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

export function PasswordChangeForm({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const messages = messagesFor(locale).settings.password;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmation = String(data.get('confirmation') ?? '');

    if (newPassword !== confirmation) {
      setError(
        new ApiError('VALIDATION_FAILED', 422, undefined, {
          confirmation: messages.mismatch,
        }),
      );
      setPending(false);
      return;
    }

    try {
      await browserApi('/auth/password/change', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      router.replace('/login');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="muted">{messages.notice}</p>

      <Field
        name="currentPassword"
        label={messages.current}
        error={error?.fieldErrors?.currentPassword}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field name="newPassword" label={messages.next} error={error?.fieldErrors?.newPassword}>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required />
      </Field>

      <Field name="confirmation" label={messages.confirm} error={error?.fieldErrors?.confirmation}>
        <PasswordInput id="confirmation" name="confirmation" autoComplete="new-password" required />
      </Field>

      {error ? <Alert error>{error.message}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? messagesFor(locale).common.saving : messages.submit}
      </Button>
    </form>
  );
}
