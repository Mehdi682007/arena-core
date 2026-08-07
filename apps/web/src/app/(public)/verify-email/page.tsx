import { Alert } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
import { getServerMessages } from '@/i18n/server';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { locale, messages } = await getServerMessages();
  return (
    <section className="stack">
      <h1>{messages.auth.verifyTitle}</h1>
      {token ? (
        <AuthForm mode="verify" locale={locale} token={token} />
      ) : (
        <Alert error>{messages.auth.verificationLinkMissing}</Alert>
      )}
    </section>
  );
}
