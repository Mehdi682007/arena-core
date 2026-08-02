import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="مدیریت مسابقه‌ها"
      description="وضعیت، شرکت‌کنندگان و جریان مالی مسابقه"
      endpoint="/admin/matches?limit=50"
    />
  );
}
