import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { Alert } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  const { token } = await searchParams;
  return (
    <section className="stack">
      <h1>{ui.changePassword}</h1>
      {token ? (
        <AuthForm mode="reset" token={token} />
      ) : (
        <Alert error>{ui.theRecoveryLinkIsNotComplete}</Alert>
      )}
    </section>
  );
}
