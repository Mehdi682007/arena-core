'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
import { PhoneLoginForm } from '@/features/auth/phone-login-form';
import type { AppLocale } from '@/i18n/config';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

type LoginMethod = 'email' | 'phone';

export function LoginMethods({ locale, returnTo }: { locale: AppLocale; returnTo: string }) {
  const [method, setMethod] = useState<LoginMethod>('email');

  const messages = rc4MessagesFor(locale).loginMethods;

  return (
    <div className="stack">
      <div className="cluster" role="group" aria-label={messages.ariaLabel}>
        <Button
          type="button"
          className={method === 'email' ? undefined : 'secondary'}
          aria-pressed={method === 'email'}
          onClick={() => {
            setMethod('email');
          }}
        >
          {messages.email}
        </Button>

        <Button
          type="button"
          className={method === 'phone' ? undefined : 'secondary'}
          aria-pressed={method === 'phone'}
          onClick={() => {
            setMethod('phone');
          }}
        >
          {messages.phone}
        </Button>
      </div>

      {method === 'email' ? (
        <AuthForm mode="login" locale={locale} returnTo={returnTo} />
      ) : (
        <PhoneLoginForm locale={locale} returnTo={returnTo} />
      )}
    </div>
  );
}
