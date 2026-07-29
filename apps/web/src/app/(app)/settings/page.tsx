import { Card } from '@/components/ui';
import { NotificationPreferences } from '@/features/notifications/preferences';
import { LogoutButton } from '@/features/session/logout-button';
import { serverApi } from '@/lib/api/server-api-client';
export default async function SettingsPage() {
  const preferences = await serverApi<Parameters<typeof NotificationPreferences>[0]['initial']>(
    '/notification-preferences',
  );
  return (
    <div className="stack">
      <h1>تنظیمات</h1>
      <Card>
        <h2>زبان و امنیت</h2>
        <p>زبان فعلی: فارسی</p>
        <p>نشست شما با کوکی HttpOnly مدیریت می‌شود؛ هیچ توکن ورود در مرورگر ذخیره نمی‌شود.</p>
        <LogoutButton />
      </Card>
      <section>
        <h2>ترجیحات اعلان</h2>
        <NotificationPreferences initial={preferences} />
      </section>
    </div>
  );
}
