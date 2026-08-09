import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { AuthForm } from '@/features/auth/auth-form';
export default async function ForgotPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  return (
    <section className="stack">
      <h1>{ui.passwordRecovery}</h1>
      <p className="muted">{ui.toProtectPrivacyTheResponseDoesNot}</p>
      <AuthForm mode="forgot" />
    </section>
  );
}
