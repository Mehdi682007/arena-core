'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { rc4MessagesFor } from '@/i18n/rc4-messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import { MfaLoginChallenge } from '@/features/auth/mfa-login-challenge';

type PhoneLoginConfirmResponse =
  | Readonly<{
      mfaRequired: true;
      challengeToken: string;
      expiresAt: string;
    }>
  | Readonly<{
      mfaRequired?: false;
    }>;
function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

export function PhoneLoginForm({ locale, returnTo }: { locale: AppLocale; returnTo: string }) {
  const router = useRouter();
  const messages = rc4MessagesFor(locale).phoneLogin;

  const [challengeId, setChallengeId] = useState<string>();
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string>();

  const [pending, setPending] = useState(false);

  const [error, setError] = useState<ApiError>();

  const [accepted, setAccepted] = useState(false);

  function completePhoneLogin(): Promise<void> {
    router.replace(returnTo);
    router.refresh();

    return Promise.resolve();
  }
  async function requestCode(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setError(undefined);
    setAccepted(false);

    const data = new FormData(event.currentTarget);

    try {
      const result = await browserApi<{
        accepted: true;
        challengeId: string;
        expiresAt: string;
      }>('/auth/phone/sign-in/request', {
        method: 'POST',
        body: {
          phone: formString(data, 'phone'),
          locale,
        },
      });

      setChallengeId(result.challengeId);

      setAccepted(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  async function confirmCode(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!challengeId) {
      return;
    }

    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    try {
      const loginResult = await browserApi<PhoneLoginConfirmResponse>(
        '/auth/phone/sign-in/confirm',
        {
          method: 'POST',
          body: {
            challengeId,
            code: formString(data, 'code'),
          },
        },
      );

      if (loginResult.mfaRequired === true) {
        setMfaChallengeToken(loginResult.challengeToken);
        return;
      }

      await completePhoneLogin();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  if (mfaChallengeToken !== undefined) {
    return (
      <MfaLoginChallenge
        locale={locale}
        challengeToken={mfaChallengeToken}
        onComplete={completePhoneLogin}
        onCancel={() => {
          setMfaChallengeToken(undefined);
          setError(undefined);
        }}
      />
    );
  }
  if (challengeId) {
    return (
      <div className="stack">
        {accepted ? <Alert>{messages.accepted}</Alert> : null}

        <form
          className="form"
          onSubmit={(event) => {
            void confirmCode(event);
          }}
        >
          <Field name="code" label={messages.code} error={error?.fieldErrors?.code}>
            <Input
              id="phoneOtpCode"
              name="code"
              dir="ltr"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </Field>

          {error ? <Alert error>{error.message || messages.genericError}</Alert> : null}

          <Button type="submit" disabled={pending}>
            {pending ? messages.confirming : messages.confirm}
          </Button>
        </form>

        <Button
          className="secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setChallengeId(undefined);
            setAccepted(false);
            setError(undefined);
          }}
        >
          {messages.changePhone}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        void requestCode(event);
      }}
    >
      <Field name="phone" label={messages.phone} error={error?.fieldErrors?.phone}>
        <Input
          id="phone"
          name="phone"
          dir="ltr"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+989121234567"
          minLength={8}
          maxLength={32}
          required
        />

        <small className="muted">{messages.phoneHint}</small>
      </Field>

      {error ? <Alert error>{error.message || messages.genericError}</Alert> : null}

      <Button type="submit" disabled={pending}>
        {pending ? messages.requesting : messages.requestCode}
      </Button>
    </form>
  );
}
