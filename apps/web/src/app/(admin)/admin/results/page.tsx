import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return <AdminResourcePage itemKey="results" endpoint="/admin/match-results/conflicts?limit=50" />;
}
