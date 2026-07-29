import { Alert } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <section className="stack">
      <h1>تغییر گذرواژه</h1>
      {token ? (
        <AuthForm mode="reset" token={token} />
      ) : (
        <Alert error>پیوند بازیابی کامل نیست.</Alert>
      )}
    </section>
  );
}
