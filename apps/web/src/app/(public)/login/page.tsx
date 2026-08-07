import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
import { getServerMessages } from '@/i18n/server';
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
  const { locale, messages } = await getServerMessages();
  return (
    <section className="stack">
      <h1>{messages.auth.loginTitle}</h1>
      <AuthForm mode="login" locale={locale} returnTo={safeReturnPath(query.returnTo)} />
      <Link href="/forgot-password">{messages.auth.forgotLink}</Link>
    </section>
  );
}
