import { AdminAction } from '@/features/admin/admin-action';
import { RecoveryForm } from '@/features/admin/support-form';
import { requireAdminPermission } from '@/features/admin/access';
export default async function SupportPage() {
  await requireAdminPermission('notifications.manage');
  return (
    <div className="stack">
      <h1>عملیات پشتیبانی</h1>
      <p>
        همه عملیات server-confirmed و ثبت‌شونده هستند. ورود به حساب دیگر یا تغییر موجودی در این بخش
        ممکن نیست.
      </p>
      <RecoveryForm />
      <section className="card stack">
        <h2>آزادسازی claimهای منقضی</h2>
        <AdminAction
          path="/admin/notifications/recovery/claims"
          body={{ limit: 25 }}
          label="آزادسازی تا ۲۵ claim"
          description="فقط claimهای منقضی پردازش می‌شوند؛ پیام فعال تغییر نمی‌کند."
        />
      </section>
    </div>
  );
}
