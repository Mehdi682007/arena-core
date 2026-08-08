import { getSession } from '@/features/session/session';
import {
  GameAccountManager,
  type ClaimableGamePlatformView,
  type GameAccountView,
} from '@/features/settings/game-account-manager';
import { serverApi } from '@/lib/api/server-api-client';
import { rc4MessagesFor } from '@/i18n/rc4-messages';

export default async function GameAccountsPage() {
  const session = await getSession();

  if (session.status !== 'authenticated') {
    return null;
  }

  const [accounts, claimablePlatforms] = await Promise.all([
    serverApi<readonly GameAccountView[]>('/game-accounts'),
    serverApi<readonly ClaimableGamePlatformView[]>('/game-accounts/claimable-platforms'),
  ]);

  const locale = session.user.locale;
  const messages = rc4MessagesFor(locale).gameAccountsPage;

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
