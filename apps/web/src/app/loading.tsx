import { Skeleton } from '@/components/ui';
export default function Loading() {
  return (
    <main className="container page stack" aria-busy="true">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </main>
  );
}
