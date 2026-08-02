import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage
      title="بررسی حساب‌های بازی"
      description="صف بررسی، وضعیت و سابقه ادعاهای حساب بازی"
      endpoint="/admin/game-accounts?limit=50"
    />
  );
}
