import { Alert } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <section className="stack">
      <h1>تأیید ایمیل</h1>
      {token ? (
        <AuthForm mode="verify" token={token} />
      ) : (
        <Alert error>پیوند تأیید کامل نیست.</Alert>
      )}
    </section>
  );
}
