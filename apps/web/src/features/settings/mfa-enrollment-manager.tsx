'use client';

import { useState, type SyntheticEvent } from 'react';
import { Alert, Badge, Button, Card, Field, Input } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

export interface MfaStatusView {
  readonly enabled: boolean;
  readonly enabledAt: string | null;
  readonly recoveryCodesRemaining: number;
}

interface Enrollment {
  readonly secret: string;
  readonly otpauthUri: string;
}

function formString(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

function text(locale: AppLocale) {
  return rc4MessagesFor(locale).mfa.featuresSettingsMfaEnrollmentManager01;
}

export function MfaEnrollmentManager({
  locale,
  initialStatus,
}: {
  locale: AppLocale;
  initialStatus: MfaStatusView;
}) {
  const messages = text(locale);

  const [status, setStatus] = useState(initialStatus);

  const [enrollment, setEnrollment] = useState<Enrollment>();

  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>();

  const [pending, setPending] = useState(false);

  const [error, setError] = useState<ApiError>();

  async function start(): Promise<void> {
    setPending(true);
    setError(undefined);

    try {
      const result = await browserApi<Enrollment>('/auth/mfa/totp/enroll/start', {
        method: 'POST',
        body: {},
      });

      setEnrollment(result);
      setRecoveryCodes(undefined);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!enrollment) {
      return;
    }

    setPending(true);
    setError(undefined);

    const data = new FormData(event.currentTarget);

    try {
      const result = await browserApi<{
        enabled: true;
        recoveryCodes: readonly string[];
      }>('/auth/mfa/totp/enroll/confirm', {
        method: 'POST',
        body: {
          code: formString(data, 'code'),
        },
      });

      setStatus({
        enabled: true,
        enabledAt: new Date().toISOString(),
        recoveryCodesRemaining: result.recoveryCodes.length,
      });

      setRecoveryCodes(result.recoveryCodes);

      setEnrollment(undefined);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
    } finally {
      setPending(false);
    }
  }

  if (recoveryCodes) {
    return (
      <Card>
        <div className="stack">
          <h2>{messages.recoveryTitle}</h2>

          <Alert>{messages.recoveryWarning}</Alert>

          <pre
            dir="ltr"
            style={{
              whiteSpace: 'pre-wrap',
              userSelect: 'all',
            }}
          >
            {recoveryCodes.join('\n')}
          </pre>

          <Button
            type="button"
            onClick={() => {
              setRecoveryCodes(undefined);
            }}
          >
            {messages.recoveryDone}
          </Button>
        </div>
      </Card>
    );
  }

  if (enrollment) {
    return (
      <Card>
        <div className="stack">
          <h2>{messages.setupTitle}</h2>

          <p className="muted">{messages.setupHint}</p>

          <a className="button secondary" href={enrollment.otpauthUri}>
            {messages.openAuthenticator}
          </a>

          <div>
            <strong>{messages.secret}</strong>

            <pre
              dir="ltr"
              style={{
                whiteSpace: 'pre-wrap',
                userSelect: 'all',
              }}
            >
              {enrollment.secret}
            </pre>
          </div>

          <form
            className="form"
            onSubmit={(event) => {
              void confirm(event);
            }}
          >
            <Field name="code" label={messages.code} error={error?.fieldErrors?.code}>
              <Input
                id="mfaEnrollmentCode"
                name="code"
                type="text"
                dir="ltr"
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
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => {
              setEnrollment(undefined);
              setError(undefined);
            }}
          >
            {messages.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="stack">
        <div>
          <h2>{messages.title}</h2>

          <p className="muted">{messages.description}</p>
        </div>

        <p>
          {messages.status}: <Badge>{status.enabled ? messages.enabled : messages.disabled}</Badge>
        </p>

        {status.enabled ? (
          <>
            <p>
              {messages.recoveryRemaining}: <strong>{status.recoveryCodesRemaining}</strong>
            </p>

            {status.enabledAt ? (
              <p className="muted">
                {messages.enabledAt}:{' '}
                {new Intl.DateTimeFormat(
                  rc4MessagesFor(locale).mfa.featuresSettingsMfaEnrollmentManager02,
                  {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  },
                ).format(new Date(status.enabledAt))}
              </p>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              void start();
            }}
          >
            {pending ? messages.starting : messages.start}
          </Button>
        )}

        {error ? <Alert error>{error.message || messages.genericError}</Alert> : null}
      </div>
    </Card>
  );
}
