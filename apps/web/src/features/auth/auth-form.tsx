'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, PasswordInput } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { persistClientLocale } from '@/i18n/client';
import { messagesFor } from '@/i18n/messages';
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

interface ProfileLocaleResponse {
  readonly profile: { readonly locale: AppLocale };
}

export function AuthForm({
  mode,
  locale,
  token,
  returnTo,
}: {
  mode: Mode;
  locale: AppLocale;
  token?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const messages = messagesFor(locale).auth;
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
          confirmation: messages.passwordsMismatch,
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
              locale,
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
        try {
          const profile = await browserApi<ProfileLocaleResponse>('/profile');
          persistClientLocale(profile.profile.locale);
        } catch {
          persistClientLocale(locale);
        }
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
          ? messages.forgotSuccess
          : mode === 'register'
            ? messages.registerSuccess
            : messages.genericSuccess}
      </Alert>
    );
  return (
    <form className="form" onSubmit={submit} noValidate>
      {['login', 'register', 'forgot'].includes(mode) ? (
        <Field name="email" label={messages.email} error={error?.fieldErrors?.email}>
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
        <Field
          name="displayName"
          label={messages.displayName}
          error={error?.fieldErrors?.displayName}
        >
          <Input id="displayName" name="displayName" autoComplete="nickname" required />
        </Field>
      ) : null}
      {['login', 'register', 'reset'].includes(mode) ? (
        <Field
          name="password"
          label={mode === 'reset' ? messages.newPassword : messages.password}
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
        <Field
          name="confirmation"
          label={messages.confirmPassword}
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
      ) : null}
      {['login', 'register', 'reset'].includes(mode) ? (
        <label className="cluster">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />{' '}
          {messages.showPassword}
        </label>
      ) : null}
      {error ? (
        <Alert error>
          {error.message}
          {error.requestId ? (
            <small className="ltr">
              {' '}
              {messagesFor(locale).common.requestId}: {error.requestId}
            </small>
          ) : null}
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending || (['reset', 'verify'].includes(mode) && !token)}>
        {pending
          ? messages.submitting
          : mode === 'login'
            ? messages.loginButton
            : mode === 'register'
              ? messages.registerButton
              : mode === 'forgot'
                ? messages.forgotButton
                : mode === 'reset'
                  ? messages.resetButton
                  : messages.verifyButton}
      </Button>
    </form>
  );
}
