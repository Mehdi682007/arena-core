import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return <AdminResourcePage itemKey="ratings" endpoint="/admin/ratings?limit=50" />;
}
