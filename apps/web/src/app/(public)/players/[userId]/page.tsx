import { notFound } from 'next/navigation';
import { Alert, Avatar, Card } from '@/components/ui';
import { getRequestLocale } from '@/i18n/server';
import { rc6MessagesFor } from '@/i18n/rc6-messages';
import { ApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server-api-client';

type PublicProfile = { userId: string; displayName: string };

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [{ userId }, locale] = await Promise.all([params, getRequestLocale()]);
  const messages = rc6MessagesFor(locale).publicProfile;
  let profile: PublicProfile;
  try {
    profile = await serverApi<PublicProfile>(`/profiles/${encodeURIComponent(userId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <Alert error>{messages.unavailable}</Alert>;
  }
  return (
    <div className="stack">
      <Card>
        <div className="profile-hero">
          <Avatar name={profile.displayName} />
          <div>
            <p className="eyebrow">{messages.title}</p>
            <h1>{profile.displayName}</h1>
            <p className="muted">{messages.identity}</p>
          </div>
        </div>
      </Card>
      <Card>
        <h2>{messages.activity}</h2>
        <p className="muted">{messages.noActivity}</p>
      </Card>
    </div>
  );
}
