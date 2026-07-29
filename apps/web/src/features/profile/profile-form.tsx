'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
export interface ProfileView {
  displayName: string | null;
  locale: 'fa' | 'en';
  timezone: string | null;
  countryCode: string | null;
}
export function ProfileForm({ profile }: { profile: ProfileView }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      await browserApi('/profile', {
        method: 'PATCH',
        body: {
          displayName: String(data.get('displayName')),
          locale: String(data.get('locale')),
          timezone: String(data.get('timezone')),
          countryCode: String(data.get('countryCode')).toUpperCase() || null,
        },
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field name="displayName" label="نام نمایشی" error={error?.fieldErrors?.displayName}>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={profile.displayName ?? ''}
          required
        />
      </Field>
      <Field name="locale" label="زبان">
        <Select id="locale" name="locale" defaultValue={profile.locale}>
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field name="timezone" label="منطقه زمانی">
        <Input
          id="timezone"
          name="timezone"
          dir="ltr"
          defaultValue={profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          required
        />
      </Field>
      <Field name="countryCode" label="کد کشور">
        <Input
          id="countryCode"
          name="countryCode"
          dir="ltr"
          maxLength={2}
          defaultValue={profile.countryCode ?? ''}
        />
      </Field>
      {saved ? <Alert>پروفایل ذخیره شد.</Alert> : null}
      {error ? <Alert error>{error.message}</Alert> : null}
      <Button disabled={pending}>{pending ? 'در حال ذخیره…' : 'ذخیره پروفایل'}</Button>
    </form>
  );
}
