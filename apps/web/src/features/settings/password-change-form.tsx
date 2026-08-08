'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, PasswordInput } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

export function PasswordChangeForm({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const messages = messagesFor(locale).security;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    const currentPassword = formString(data, 'currentPassword');

    const newPassword = formString(data, 'newPassword');

    const confirmation = formString(data, 'confirmation');

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
        body: {
          currentPassword,
          newPassword,
        },
      });

      router.replace('/login');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));

      setPending(false);
    }
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Field
        name="currentPassword"
        label={messages.currentPassword}
        error={error?.fieldErrors?.currentPassword}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        name="newPassword"
        label={messages.newPassword}
        error={error?.fieldErrors?.newPassword}
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        name="confirmation"
        label={messages.confirmation}
        error={error?.fieldErrors?.confirmation}
      >
        <PasswordInput
          id="confirmation"
          name="confirmation"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
        />
      </Field>

      <label className="cluster">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(event) => {
            setShowPassword(event.target.checked);
          }}
        />

        {messages.showPassword}
      </label>

      {error ? <Alert error>{error.message}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? messages.changingPassword : messages.changePassword}
      </Button>
    </form>
  );
}
