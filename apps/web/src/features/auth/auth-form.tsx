'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, PasswordInput } from '@/components/ui';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import { safeReturnPath } from '@/lib/auth/redirect';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
const endpoint: Record<Mode, string> = {
  login: '/auth/login',
  register: '/auth/register',
  forgot: '/auth/password-reset/request',
  reset: '/auth/password-reset/confirm',
  verify: '/auth/email-verification/confirm',
};
export function AuthForm({
  mode,
  token,
  returnTo,
}: {
  mode: Mode;
  token?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirmation') ?? '');
    if (['register', 'reset'].includes(mode) && password !== confirmation) {
      setError(
        new ApiError('VALIDATION_FAILED', 422, undefined, {
          confirmation: 'گذرواژه‌ها یکسان نیستند.',
        }),
      );
      setPending(false);
      return;
    }
    const email = String(data.get('email') ?? '');
    const body =
      mode === 'login'
        ? { email, password }
        : mode === 'register'
          ? {
              email,
              password,
              displayName: String(data.get('displayName') ?? ''),
              locale: 'fa',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : mode === 'forgot'
            ? { email }
            : mode === 'reset'
              ? { token, newPassword: password }
              : { token };
    try {
      await browserApi(endpoint[mode], { method: 'POST', body });
      if (mode === 'login') {
        router.replace(safeReturnPath(returnTo));
        router.refresh();
        return;
      }
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }
  if (success)
    return (
      <Alert>
        {mode === 'forgot'
          ? 'اگر حسابی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.'
          : mode === 'register'
            ? 'ثبت‌نام انجام شد. ایمیل خود را برای تأیید حساب بررسی کنید.'
            : 'عملیات با موفقیت انجام شد.'}
      </Alert>
    );
  return (
    <form className="form" onSubmit={submit} noValidate>
      {['login', 'register', 'forgot'].includes(mode) ? (
        <Field name="email" label="ایمیل" error={error?.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            dir="ltr"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(error?.fieldErrors?.email)}
          />
        </Field>
      ) : null}
      {mode === 'register' ? (
        <Field name="displayName" label="نام نمایشی" error={error?.fieldErrors?.displayName}>
          <Input id="displayName" name="displayName" autoComplete="nickname" required />
        </Field>
      ) : null}
      {['login', 'register', 'reset'].includes(mode) ? (
        <Field
          name="password"
          label={mode === 'reset' ? 'گذرواژه جدید' : 'گذرواژه'}
          error={error?.fieldErrors?.password}
        >
          <PasswordInput
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            aria-invalid={Boolean(error?.fieldErrors?.password)}
          />
        </Field>
      ) : null}
      {['register', 'reset'].includes(mode) ? (
        <Field name="confirmation" label="تکرار گذرواژه" error={error?.fieldErrors?.confirmation}>
          <PasswordInput
            id="confirmation"
            name="confirmation"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
          />
        </Field>
      ) : null}
      {['login', 'register', 'reset'].includes(mode) ? (
        <label className="cluster">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />{' '}
          نمایش گذرواژه
        </label>
      ) : null}
      {error ? (
        <Alert error>
          {error.message}
          {error.requestId ? <small className="ltr"> شناسه پیگیری: {error.requestId}</small> : null}
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending || (['reset', 'verify'].includes(mode) && !token)}>
        {pending
          ? 'در حال ارسال…'
          : mode === 'login'
            ? 'ورود'
            : mode === 'register'
              ? 'ساخت حساب'
              : mode === 'forgot'
                ? 'ارسال راهنما'
                : mode === 'reset'
                  ? 'تغییر گذرواژه'
                  : 'تأیید ایمیل'}
      </Button>
    </form>
  );
}
