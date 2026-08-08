'use client';

import { useState, type SyntheticEvent } from 'react';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { localeCookieName, localeDirection, type AppLocale } from '@/i18n/config';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

export interface ProfileView {
  displayName: string | null;
  locale: AppLocale;
  timezone: string | null;
  countryCode: string | null;
}

function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

export function ProfileForm({ profile }: { profile: ProfileView }) {
  const messages = messagesFor(profile.locale).profile;

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [pending, setPending] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setSaved(false);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    const nextLocale = formString(data, 'locale') as AppLocale;

    try {
      await browserApi('/profile', {
        method: 'PATCH',
        body: {
          displayName: formString(data, 'displayName'),
          locale: nextLocale,
          timezone: formString(data, 'timezone'),
          countryCode: formString(data, 'countryCode').trim().toUpperCase() || null,
        },
      });

      if (nextLocale !== profile.locale) {
        document.cookie = [
          `${localeCookieName}=${nextLocale}`,
          'Path=/',
          'Max-Age=31536000',
          'SameSite=Lax',
          window.location.protocol === 'https:' ? 'Secure' : '',
        ]
          .filter(Boolean)
          .join('; ');

        document.documentElement.lang = nextLocale;
        document.documentElement.dir = localeDirection(nextLocale);

        window.location.reload();
        return;
      }

      setSaved(true);
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
    >
      <Field
        name="displayName"
        label={messages.displayName}
        error={error?.fieldErrors?.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          defaultValue={profile.displayName ?? ''}
          minLength={2}
          maxLength={40}
          required
        />
      </Field>

      <Field name="locale" label={messages.language}>
        <Select id="locale" name="locale" defaultValue={profile.locale}>
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </Select>
      </Field>

      <Field name="timezone" label={messages.timezone}>
        <Input
          id="timezone"
          name="timezone"
          dir="ltr"
          maxLength={64}
          defaultValue={profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          required
        />
      </Field>

      <Field name="countryCode" label={messages.countryCode}>
        <Input
          id="countryCode"
          name="countryCode"
          dir="ltr"
          minLength={2}
          maxLength={2}
          defaultValue={profile.countryCode ?? ''}
        />
      </Field>

      {saved ? <Alert>{messages.saved}</Alert> : null}

      {error ? <Alert error>{error.message}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? messages.saving : messages.save}
      </Button>
    </form>
  );
}
