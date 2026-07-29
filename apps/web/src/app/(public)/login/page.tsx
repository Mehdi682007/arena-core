import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
import { safeReturnPath } from '@/lib/auth/redirect';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if ((await getSession()).status === 'authenticated') redirect('/dashboard');
  const query = await searchParams;
  return (
    <section className="stack">
      <h1>ورود</h1>
      <AuthForm mode="login" returnTo={safeReturnPath(query.returnTo)} />
      <Link href="/forgot-password">گذرواژه را فراموش کرده‌اید؟</Link>
    </section>
  );
}
