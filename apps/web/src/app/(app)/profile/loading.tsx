import { Card, Skeleton } from '@/components/ui';

export default function ProfileLoading() {
  return (
    <div className="stack">
      <Card>
        <div className="profile-hero">
          <Skeleton />
          <div>
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      </Card>

      <div className="profile-stat-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton />
          </Card>
        ))}
      </div>

      <Card>
        <Skeleton />
      </Card>
    </div>
  );
}
