import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return <AdminResourcePage itemKey="matches" endpoint="/admin/matches?limit=50" />;
}
