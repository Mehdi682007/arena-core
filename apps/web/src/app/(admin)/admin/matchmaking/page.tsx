import { AdminResourcePage } from '@/features/admin/resource-page';
export default function Page() {
  return (
    <AdminResourcePage itemKey="matchmaking" endpoint="/admin/matchmaking/requests?limit=50" />
  );
}
