import { Alert, Card } from '@/components/ui';
import { ProfileForm, type ProfileView } from '@/features/profile/profile-form';
import { serverApi } from '@/lib/api/server-api-client';
export default async function ProfilePage() {
  const result = await serverApi<{
    profile: ProfileView;
    onboarding: { completed: boolean; missingSteps: string[] };
  }>('/profile');
  return (
    <div className="stack">
      <h1>پروفایل</h1>
      <Card>
        <p>وضعیت شروع کار: {result.onboarding.completed ? 'تکمیل‌شده' : 'نیازمند تکمیل'}</p>
        {result.onboarding.missingSteps.length ? (
          <Alert>
            مراحل باقی‌مانده:{' '}
            <span className="ltr">{result.onboarding.missingSteps.join(', ')}</span>
          </Alert>
        ) : null}
      </Card>
      <Card>
        <h2>اطلاعات پایه</h2>
        <ProfileForm profile={result.profile} />
      </Card>
    </div>
  );
}
