'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { persistClientLocale } from '@/i18n/client';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

export interface EditableProfile {
  readonly displayName: string | null;
  readonly locale: AppLocale;
  readonly timezone: string | null;
  readonly countryCode: string | null;
}

export function ProfileForm({ initial }: { initial: EditableProfile }) {
  const router = useRouter();
  const [locale, setLocale] = useState<AppLocale>(initial.locale);
  const messages = messagesFor(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(undefined);

    const data = new FormData(event.currentTarget);
    const nextLocale = String(data.get('locale') ?? initial.locale) as AppLocale;
    const country = String(data.get('countryCode') ?? '')
      .trim()
      .toUpperCase();

    try {
      await browserApi('/profile', {
        method: 'PATCH',
        body: {
          displayName: String(data.get('displayName') ?? '').trim(),
          locale: nextLocale,
          timezone: String(data.get('timezone') ?? '').trim(),
          countryCode: country.length === 0 ? null : country,
        },
      });
      persistClientLocale(nextLocale);
      setLocale(nextLocale);
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field
        name="displayName"
        label={messages.settings.profile.displayName}
        error={error?.fieldErrors?.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          autoComplete="nickname"
          defaultValue={initial.displayName ?? ''}
          maxLength={160}
          required
        />
      </Field>

      <Field
        name="locale"
        label={messages.settings.profile.locale}
        error={error?.fieldErrors?.locale}
      >
        <Select
          id="locale"
          name="locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value as AppLocale)}
        >
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </Select>
      </Field>

      <Field
        name="timezone"
        label={messages.settings.profile.timezone}
        error={error?.fieldErrors?.timezone}
      >
        <Input
          id="timezone"
          name="timezone"
          dir="ltr"
          defaultValue={initial.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          maxLength={64}
          required
        />
      </Field>

      <Field
        name="countryCode"
        label={messages.settings.profile.countryCode}
        error={error?.fieldErrors?.countryCode}
      >
        <Input
          id="countryCode"
          name="countryCode"
          dir="ltr"
          defaultValue={initial.countryCode ?? ''}
          maxLength={2}
          minLength={2}
          placeholder={messages.settings.profile.countryPlaceholder}
          autoComplete="country"
        />
      </Field>

      {error ? <Alert error>{error.message}</Alert> : null}
      {saved ? <Alert>{messages.settings.profile.saved}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? messages.common.saving : messages.common.save}
      </Button>
    </form>
  );
}
