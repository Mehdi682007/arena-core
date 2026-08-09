import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return <AdminResourcePage itemKey="settlements" endpoint="/admin/match-settlements?limit=50" />;
}
