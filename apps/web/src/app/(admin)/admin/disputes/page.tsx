import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return <AdminResourcePage itemKey="disputes" endpoint="/admin/match-disputes?limit=50" />;
}
