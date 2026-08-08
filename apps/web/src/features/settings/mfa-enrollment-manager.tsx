'use client';

import { useState, type SyntheticEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  readonly expiresAt?: string;
  readonly mode: 'enroll' | 'rotate';
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
      const mode = status.enabled ? 'rotate' : 'enroll';
      const result = await browserApi<Omit<Enrollment, 'mode'>>(`/auth/mfa/totp/${mode}/start`, {
        method: 'POST',
        body: {},
      });

      setEnrollment({ ...result, mode });
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
      }>(`/auth/mfa/totp/${enrollment.mode}/confirm`, {
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

  async function cancel(): Promise<void> {
    if (enrollment?.mode === 'rotate') {
      setPending(true);
      try {
        await browserApi('/auth/mfa/totp/rotate/cancel', { method: 'POST', body: {} });
      } catch (caught) {
        setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL_ERROR', 500));
        setPending(false);
        return;
      }
      setPending(false);
    }
    setEnrollment(undefined);
    setError(undefined);
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
  }

  function downloadRecoveryCodes(): void {
    if (!recoveryCodes) return;
    const url = URL.createObjectURL(
      new Blob([`${recoveryCodes.join('\n')}\n`], { type: 'text/plain' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'arena-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (recoveryCodes) {
    return (
      <Card>
        <div className="stack">
          <h2>{messages.recoveryTitle}</h2>

          <Alert>{messages.recoveryWarning}</Alert>
          <Alert error>{messages.recoveryEmergencyWarning}</Alert>

          <pre
            dir="ltr"
            style={{
              whiteSpace: 'pre-wrap',
              userSelect: 'all',
            }}
          >
            {recoveryCodes.join('\n')}
          </pre>

          <div className="cluster">
            <Button
              type="button"
              className="secondary"
              onClick={() => void copy(recoveryCodes.join('\n'))}
            >
              {messages.copyRecovery}
            </Button>
            <Button type="button" className="secondary" onClick={downloadRecoveryCodes}>
              {messages.downloadRecovery}
            </Button>
          </div>

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
          <ol>
            <li>{messages.instruction1}</li>
            <li>{messages.instruction2}</li>
            <li>{messages.instruction3}</li>
          </ol>

          <div style={{ background: '#fff', padding: 16, width: 'fit-content', maxWidth: '100%' }}>
            <QRCodeSVG
              value={enrollment.otpauthUri}
              size={220}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
              marginSize={4}
              role="img"
              aria-label={messages.qrLabel}
            />
          </div>

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
            <Button
              type="button"
              className="secondary"
              onClick={() => void copy(enrollment.secret)}
            >
              {messages.copyKey}
            </Button>
          </div>

          <Alert>{messages.setupWarning}</Alert>

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
            onClick={() => void cancel()}
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
            <Button type="button" disabled={pending} onClick={() => void start()}>
              {pending ? messages.starting : messages.replace}
            </Button>
            <p className="muted">{messages.replaceDescription}</p>
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
