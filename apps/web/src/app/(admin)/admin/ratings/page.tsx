import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="رتبه‌بندی"
      description="تغییرات، اعمال ناموفق و وضعیت reconciliation"
      endpoint="/admin/ratings?limit=50"
    />
  );
}
