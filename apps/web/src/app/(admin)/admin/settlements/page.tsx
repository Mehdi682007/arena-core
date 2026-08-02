import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="تسویه مسابقه"
      description="تسویه‌ها، بازپرداخت و تلاش‌های ناموفق"
      endpoint="/admin/match-settlements?limit=50"
    />
  );
}
