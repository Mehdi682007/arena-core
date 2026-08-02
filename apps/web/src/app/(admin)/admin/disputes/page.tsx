import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="مدیریت اختلاف‌ها"
      description="صف اختلاف‌های باز، تخصیص و بررسی"
      endpoint="/admin/match-disputes?limit=50"
    />
  );
}
