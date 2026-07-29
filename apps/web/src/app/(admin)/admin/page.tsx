import Link from 'next/link';
import { Alert, Card } from '@/components/ui';
import { getAdminAccess } from '@/features/admin/access';

export default async function AdminDashboard() {
  const access = await getAdminAccess();
  if (access.status !== 'allowed') return <Alert error>قابلیت‌های مدیریت در دسترس نیست.</Alert>;
  const allowed = new Set(access.permissions);
  const links = [
    ['audit.read', '/admin/audit', 'رویدادهای ممیزی'],
    ['support.read', '/admin/search', 'جستجوی پشتیبانی'],
    ['notifications.read', '/admin/notifications', 'عملیات اعلان‌ها'],
    ['diagnostics.read', '/admin/diagnostics', 'وضعیت سرویس'],
    ['support.manage', '/admin/support', 'عملیات پشتیبانی'],
  ] as const;
  return (
    <div className="stack">
      <h1>پنل مدیریت</h1>
      <Alert>عملیات این بخش ثبت و توسط Backend مجدداً مجوزسنجی می‌شود.</Alert>
      <div className="grid">
        {links
          .filter(([permission]) => allowed.has(permission))
          .map(([, href, label]) => (
            <Card key={href}>
              <h2>{label}</h2>
              <Link href={href}>ورود</Link>
            </Card>
          ))}
      </div>
    </div>
  );
}
