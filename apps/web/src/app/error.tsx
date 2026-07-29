'use client';
import { Button, ErrorState } from '@/components/ui';
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container page stack">
      <ErrorState />
      <Button onClick={reset}>تلاش دوباره</Button>
    </main>
  );
}
