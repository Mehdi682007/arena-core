'use client';

import { useEffect } from 'react';
import { Button, Card, ErrorState } from '@/components/ui';

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error;
  }, [error]);

  return (
    <Card>
      <ErrorState />

      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
