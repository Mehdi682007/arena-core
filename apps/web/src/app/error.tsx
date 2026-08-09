'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { Button, ErrorState } from '@/components/ui';
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ui = useUiMessages();
  return (
    <main className="container page stack">
      <ErrorState />
      <Button onClick={reset}>{ui.tryAgain2}</Button>
    </main>
  );
}
