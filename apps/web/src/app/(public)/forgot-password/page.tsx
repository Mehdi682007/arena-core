import { AuthForm } from '@/features/auth/auth-form';
import { getServerMessages } from '@/i18n/server';

export default async function ForgotPage() {
  const { locale, messages } = await getServerMessages();
  return (
    <section className="stack">
      <h1>{messages.auth.forgotTitle}</h1>
      <p className="muted">{messages.auth.privacyHint}</p>
      <AuthForm mode="forgot" locale={locale} />
    </section>
  );
}
