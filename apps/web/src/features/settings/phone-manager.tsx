'use client';

import { useState, type SyntheticEvent } from 'react';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { rc4MessagesFor } from '@/i18n/rc4-messages';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';

export interface UserPhoneView {
  readonly id: string;
  readonly phoneE164: string;
  readonly isPrimary: boolean;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}

function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

export function PhoneManager({
  initialPhones,
  locale,
}: {
  initialPhones: readonly UserPhoneView[];
  locale: AppLocale;
}) {
  const messages = rc4MessagesFor(locale).phoneManager;

  const [phones, setPhones] = useState([...initialPhones]);

  const [challengeId, setChallengeId] = useState<string>();

  const [pending, setPending] = useState(false);

  const [accepted, setAccepted] = useState(false);

  const [verified, setVerified] = useState(false);

  const [error, setError] = useState<ApiError>();

  async function requestVerification(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setAccepted(false);
    setVerified(false);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    try {
      const result = await browserApi<{
        accepted: true;
        challengeId: string;
        expiresAt: string;
      }>('/auth/phone/verification/request', {
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

  async function confirmVerification(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!challengeId) {
      return;
    }

    setPending(true);
    setError(undefined);
    setVerified(false);

    const data = new FormData(event.currentTarget);

    try {
      const result = await browserApi<{
        phone: UserPhoneView;
      }>('/auth/phone/verification/confirm', {
        method: 'POST',
        body: {
          challengeId,
          code: formString(data, 'code'),
        },
      });

      setPhones((current) => [
        ...current.filter((item) => item.id !== result.phone.id),
        result.phone,
      ]);

      setChallengeId(undefined);
      setAccepted(false);
      setVerified(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <section className="stack">
        <h2>{messages.phones}</h2>

        {phones.length === 0 ? <p className="muted">{messages.empty}</p> : null}

        {phones.map((phone) => (
          <Card key={phone.id}>
            <div className="cluster">
              <strong className="ltr">{phone.phoneE164}</strong>

              {phone.verifiedAt ? <Badge>{messages.verified}</Badge> : null}

              {phone.isPrimary ? <Badge>{messages.primary}</Badge> : null}
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <h2>{messages.add}</h2>

        {verified ? <Alert>{messages.verifiedSuccess}</Alert> : null}

        {accepted ? <Alert>{messages.accepted}</Alert> : null}

        {error ? <Alert error>{error.message || messages.failed}</Alert> : null}

        {challengeId ? (
          <div className="stack">
            <form
              className="form"
              onSubmit={(event) => {
                void confirmVerification(event);
              }}
            >
              <Field name="code" label={messages.code} error={error?.fieldErrors?.code}>
                <Input
                  id="phoneVerificationCode"
                  name="code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                />
              </Field>

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
              {messages.cancel}
            </Button>
          </div>
        ) : (
          <form
            className="form"
            onSubmit={(event) => {
              void requestVerification(event);
            }}
          >
            <Field name="phone" label={messages.phone} error={error?.fieldErrors?.phone}>
              <Input
                id="settingsPhone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="+989121234567"
                minLength={8}
                maxLength={32}
                required
              />

              <small className="muted">{messages.hint}</small>
            </Field>

            <Button type="submit" disabled={pending}>
              {pending ? messages.requesting : messages.request}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
