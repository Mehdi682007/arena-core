import { GameAccountManager } from '@/features/game-accounts/game-account-manager';
import type {
  ClaimableGamePlatform,
  UserGameAccountView,
} from '@/features/game-accounts/types';
import type { AppLocale } from '@/i18n/config';
import { gameAccountMessagesFor } from '@/i18n/game-account-messages';
import { serverApi } from '@/lib/api/server-api-client';

interface ProfileResponse {
  readonly profile: { readonly locale: AppLocale };
}

export default async function GameAccountsSettingsPage() {
  const [profile, accounts, claimablePlatforms] = await Promise.all([
    serverApi<ProfileResponse>('/profile'),
    serverApi<UserGameAccountView[]>('/game-accounts'),
    serverApi<ClaimableGamePlatform[]>('/game-accounts/claimable-platforms'),
  ]);
  const locale = profile.profile.locale;
  const messages = gameAccountMessagesFor(locale);

  return (
    <div className="stack">
      <div>
        <h1>{messages.title}</h1>
        <p className="muted">{messages.description}</p>
      </div>
      <GameAccountManager
        initialAccounts={accounts}
        claimablePlatforms={claimablePlatforms}
        locale={locale}
      />
    </div>
  );
}
