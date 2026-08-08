'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, PasswordInput } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { persistClientLocale } from '@/i18n/client';
import { messagesFor } from '@/i18n/messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import { safeReturnPath } from '@/lib/auth/redirect';
import { MfaLoginChallenge } from '@/features/auth/mfa-login-challenge';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

const endpoint: Record<Mode, string> = {
  login: '/auth/login',
  register: '/auth/register',
  forgot: '/auth/password-reset/request',
  reset: '/auth/password-reset/confirm',
  verify: '/auth/email-verification/confirm',
};

function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

interface ProfileLocaleResponse {
  readonly profile: {
    readonly locale: AppLocale;
  };
}
type LoginResponse =
  | Readonly<{
      mfaRequired: true;
      challengeToken: string;
      expiresAt: string;
    }>
  | Readonly<{
      mfaRequired?: false;
    }>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProfileLocaleResponse(value: unknown): value is ProfileLocaleResponse {
  if (!isRecord(value)) {
    return false;
  }

  const profile = value['profile'];

  if (!isRecord(profile)) {
    return false;
  }

  const locale = profile['locale'];

  return locale === 'fa' || locale === 'en';
}
export function AuthForm({
  mode,
  token,
  returnTo,
  locale = 'fa',
}: {
  mode: Mode;
  token?: string;
  returnTo?: string;
  locale?: AppLocale;
}) {
  const router = useRouter();
  const messages = messagesFor(locale).auth;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string>();

  async function completeLogin() {
    try {
      const response = await browserApi<unknown>('/profile');

      if (isProfileLocaleResponse(response)) {
        persistClientLocale(response.profile.locale);
      } else {
        persistClientLocale(locale);
      }
    } catch {
      persistClientLocale(locale);
    }

    router.replace(safeReturnPath(returnTo));

    router.refresh();
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    const password = formString(data, 'password');

    const confirmation = formString(data, 'confirmation');

    if (['register', 'reset'].includes(mode) && password !== confirmation) {
      setError(
        new ApiError('VALIDATION_FAILED', 422, undefined, {
          confirmation: messages.passwordMismatch,
        }),
      );

      setPending(false);
      return;
    }

    const email = formString(data, 'email');

    const body =
      mode === 'login'
        ? {
            email,
            password,
          }
        : mode === 'register'
          ? {
              email,
              password,
              displayName: formString(data, 'displayName'),
              locale,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : mode === 'forgot'
            ? {
                email,
              }
            : mode === 'reset'
              ? {
                  token,
                  newPassword: password,
                }
              : {
                  token,
                };

    try {
      if (mode === 'login') {
        const result = await browserApi<LoginResponse>(endpoint[mode], {
          method: 'POST',
          body,
        });

        if (result.mfaRequired === true) {
          setMfaChallengeToken(result.challengeToken);
          return;
        }

        await completeLogin();
        return;
      }

      await browserApi(endpoint[mode], {
        method: 'POST',
        body,
      });

      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  if (mode === 'login' && mfaChallengeToken !== undefined) {
    return (
      <MfaLoginChallenge
        locale={locale}
        challengeToken={mfaChallengeToken}
        onComplete={completeLogin}
        onCancel={() => {
          setMfaChallengeToken(undefined);
          setError(undefined);
        }}
      />
    );
  }
  if (success) {
    return (
      <Alert>
        {mode === 'forgot'
          ? messages.forgotSuccess
          : mode === 'register'
            ? messages.registerSuccess
            : messages.genericSuccess}
      </Alert>
    );
  }

  const submitLabel =
    mode === 'login'
      ? messages.submitLogin
      : mode === 'register'
        ? messages.submitRegister
        : mode === 'forgot'
          ? messages.submitForgot
          : mode === 'reset'
            ? messages.submitReset
            : messages.submitVerify;

  return (
    <form
      className="form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
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
          label={messages.passwordConfirmation}
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
            onChange={(event) => {
              setShowPassword(event.target.checked);
            }}
          />

          {messages.showPassword}
        </label>
      ) : null}

      {error ? (
        <Alert error>
          {error.message}

          {error.requestId ? (
            <small className="ltr">
              {' '}
              {messages.requestId}: {error.requestId}
            </small>
          ) : null}
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || (['reset', 'verify'].includes(mode) && !token)}>
        {pending ? messages.submitting : submitLabel}
      </Button>
    </form>
  );
}
