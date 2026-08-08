import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
import { messagesFor } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function RegisterPage() {
  if ((await getSession()).status === 'authenticated') {
    redirect('/dashboard');
  }

  const locale = await getRequestLocale();
  const messages = messagesFor(locale).auth;

  return (
    <section className="stack">
      <h1>{messages.registerTitle}</h1>

      <p className="muted">{messages.registerDescription}</p>

      <AuthForm mode="register" locale={locale} />

      <Link href="/login">{messages.alreadyHaveAccount}</Link>
    </section>
  );
}
