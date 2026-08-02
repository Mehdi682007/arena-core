import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="همتایابی"
      description="درخواست‌ها، محدودیت‌ها و وضعیت پیشنهادها"
      endpoint="/admin/matchmaking/requests?limit=50"
    />
  );
}
