import { AdminSearchForm } from '@/features/admin/search-form';
import { requireAdminPermission } from '@/features/admin/access';
export default async function SearchPage() {
  await requireAdminPermission('support.read');
  return (
    <div className="stack">
      <h1>جستجوی پشتیبانی</h1>
      <p>جستجو فقط پس از ارسال فرم انجام می‌شود.</p>
      <AdminSearchForm />
    </div>
  );
}
