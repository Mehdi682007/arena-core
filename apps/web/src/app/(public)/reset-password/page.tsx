import { Alert } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
import { getServerMessages } from '@/i18n/server';

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { locale, messages } = await getServerMessages();
  return (
    <section className="stack">
      <h1>{messages.auth.resetTitle}</h1>
      {token ? (
        <AuthForm mode="reset" locale={locale} token={token} />
      ) : (
        <Alert error>{messages.auth.resetLinkMissing}</Alert>
      )}
    </section>
  );
}
