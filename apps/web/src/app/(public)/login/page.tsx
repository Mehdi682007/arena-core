import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginMethods } from '@/features/auth/login-methods';
import { getSession } from '@/features/session/session';
import { messagesFor } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import { safeReturnPath } from '@/lib/auth/redirect';
import { isAdminHostname } from '@/lib/host-policy';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string;
  }>;
}) {
  if ((await getSession()).status === 'authenticated') {
    const host = (await headers()).get('host');

    redirect(isAdminHostname(host) ? '/admin' : '/dashboard');
  }

  const locale = await getRequestLocale();

  const messages = messagesFor(locale).auth;

  const query = await searchParams;

  const returnTo = safeReturnPath(query.returnTo);

  return (
    <section className="stack">
      <h1>{messages.loginTitle}</h1>

      <LoginMethods locale={locale} returnTo={returnTo} />

      <Link href="/forgot-password">{messages.forgotPasswordLink}</Link>
    </section>
  );
}
