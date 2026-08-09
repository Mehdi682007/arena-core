import { uiMessagesFor } from '@/i18n/ui-messages';
import { getRequestLocale } from '@/i18n/server';
import { AdminAction } from '@/features/admin/admin-action';
import { RecoveryForm } from '@/features/admin/support-form';
import { requireAdminPermission } from '@/features/admin/access';
export default async function SupportPage() {
  const locale = await getRequestLocale();
  const ui = uiMessagesFor(locale);
  await requireAdminPermission('notifications.manage');
  return (
    <div className="stack">
      <h1>{ui.supportOperations}</h1>
      <p>{ui.allOperationsAreServerConfirmedAndRecorded}</p>
      <RecoveryForm />
      <section className="card stack">
        <h2>{ui.releaseOfExpiredClaims}</h2>
        <AdminAction
          path="/admin/notifications/recovery/claims"
          body={{ limit: 25 }}
          label={ui.freeingUpToN25Claims}
          description={ui.onlyExpiredClaimsAreProcessedTheActive}
        />
      </section>
    </div>
  );
}
