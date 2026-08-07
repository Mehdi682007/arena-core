'use client';

import { useEffect, useState } from 'react';
import type { AppLocale } from '@/i18n/config';

const remainingParts = (expiresAt: string, now: number, locale: AppLocale) => {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  return `${new Intl.NumberFormat(numberLocale).format(minutes)}:${new Intl.NumberFormat(
    numberLocale,
    {
      minimumIntegerDigits: 2,
    },
  ).format(seconds % 60)}`;
};

export function Countdown({
  expiresAt,
  locale,
  label,
}: {
  expiresAt: string;
  locale: AppLocale;
  label: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <p aria-live="polite">
      {label}: <b>{remainingParts(expiresAt, now, locale)}</b>
    </p>
  );
}
