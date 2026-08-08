import { Alert, Card } from '@/components/ui';
import { ProfileForm, type ProfileView } from '@/features/profile/profile-form';
import { messagesFor } from '@/i18n/messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function ProfilePage() {
  const result = await serverApi<{
    profile: ProfileView;
    onboarding: {
      completed: boolean;
      missingSteps: string[];
    };
  }>('/profile');

  const messages = messagesFor(result.profile.locale).profile;

  const remainingSteps = result.onboarding.missingSteps.map(
    (step) => messages.missingSteps[step] ?? step,
  );

  return (
    <div className="stack">
      <h1>{messages.title}</h1>

      <Card>
        <p>
          {messages.onboardingStatus}:{' '}
          {result.onboarding.completed ? messages.completed : messages.incomplete}
        </p>

        {remainingSteps.length ? (
          <Alert>
            {messages.remainingSteps}: {remainingSteps.join(', ')}
          </Alert>
        ) : null}
      </Card>

      <Card>
        <h2>{messages.basicInformation}</h2>
        <ProfileForm profile={result.profile} />
      </Card>
    </div>
  );
}
