import { Alert, Card } from '@/components/ui';
import { ProfileForm, type EditableProfile } from '@/features/settings/profile-form';
import { productMessagesFor } from '@/i18n/product-messages';
import { serverApi } from '@/lib/api/server-api-client';

export default async function ProfilePage() {
  const result = await serverApi<{
    profile: EditableProfile;
    onboarding: { completed: boolean; missingSteps: string[] };
  }>('/profile');
  const messages = productMessagesFor(result.profile.locale).profile;
  return (
    <div className="stack">
      <h1>{messages.title}</h1>
      <Card>
        <p>
          {messages.onboardingStatus}:{' '}
          {result.onboarding.completed
            ? messages.onboardingComplete
            : messages.onboardingIncomplete}
        </p>
        {result.onboarding.missingSteps.length ? (
          <Alert>
            {messages.remainingSteps}:{' '}
            <span className="ltr">{result.onboarding.missingSteps.join(', ')}</span>
          </Alert>
        ) : null}
      </Card>
      <Card>
        <h2>{messages.basicInformation}</h2>
        <ProfileForm initial={result.profile} />
      </Card>
    </div>
  );
}
