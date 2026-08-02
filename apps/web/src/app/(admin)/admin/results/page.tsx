import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="تعارض نتیجه‌ها"
      description="ارسال‌های رقیب و شواهد نیازمند تصمیم انسانی"
      endpoint="/admin/match-results/conflicts?limit=50"
    />
  );
}
