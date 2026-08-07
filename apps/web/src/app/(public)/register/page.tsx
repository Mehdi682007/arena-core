import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/features/auth/auth-form';
import { getSession } from '@/features/session/session';
import { getServerMessages } from '@/i18n/server';

export default async function RegisterPage() {
  if ((await getSession()).status === 'authenticated') redirect('/dashboard');
  const { locale, messages } = await getServerMessages();
  return (
    <section className="stack">
      <h1>{messages.auth.registerTitle}</h1>
      <p className="muted">{messages.auth.registerHint}</p>
      <AuthForm mode="register" locale={locale} />
      <Link href="/login">{messages.auth.haveAccount}</Link>
    </section>
  );
}
