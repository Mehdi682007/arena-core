import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
import { safeReturnPath } from '@/lib/auth/redirect';
import { isAdminHostname } from '@/lib/host-policy';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if ((await getSession()).status === 'authenticated') {
    const host = (await headers()).get('host');
    redirect(isAdminHostname(host) ? '/admin' : '/dashboard');
  }
  const query = await searchParams;
  return (
    <section className="stack">
      <h1>ورود</h1>
      <AuthForm mode="login" returnTo={safeReturnPath(query.returnTo)} />
      <Link href="/forgot-password">گذرواژه را فراموش کرده‌اید؟</Link>
    </section>
  );
}
