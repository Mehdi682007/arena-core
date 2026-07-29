'use client';

import { useEffect, useState } from 'react';

const remainingParts = (expiresAt: string, now: number) => {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${new Intl.NumberFormat('fa').format(minutes)}:${new Intl.NumberFormat('fa', {
    minimumIntegerDigits: 2,
  }).format(seconds % 60)}`;
};

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <p aria-live="polite">
      زمان باقی‌مانده: <b>{remainingParts(expiresAt, now)}</b>
    </p>
  );
}
