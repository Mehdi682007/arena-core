import { Card } from '@/components/ui';
import { ProfileForm, type EditableProfile } from '@/features/settings/profile-form';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: EditableProfile;
}

export default async function ProfileSettingsPage() {
  const response = await serverApi<ProfileResponse>('/profile');
  const messages = messagesFor(response.profile.locale).settings;
  return (
    <div className="stack">
      <div>
        <h1>{messages.profileTitle}</h1>
        <p className="muted">{messages.profileDescription}</p>
      </div>
      <Card>
        <ProfileForm initial={response.profile} />
      </Card>
    </div>
  );
}
