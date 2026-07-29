import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import type { IdentityModuleOverrides } from './identity/identity.module';
import { EmailModule } from './email/email.module';
import { ProfileModule, type ProfileModuleOverrides } from './profile/profile.module';
import {
  GameCatalogModule,
  type GameCatalogModuleOverrides,
} from './game-catalog/game-catalog.module';
import {
  PlayerIdentityModule,
  type PlayerIdentityModuleOverrides,
} from './player-identity/player-identity.module';
import {
  MatchmakingModule,
  type MatchmakingModuleOverrides,
} from './matchmaking/matchmaking.module';
import { MatchesModule, type MatchesModuleOverrides } from './matches/matches.module';
import { WalletModule, type WalletModuleOverrides } from './wallet/wallet.module';
import {
  MatchFinanceModule,
  type MatchFinanceModuleOverrides,
} from './match-finance/match-finance.module';
import { RatingsModule, type RatingsModuleOverrides } from './ratings/ratings.module';
import {
  NotificationsModule,
  type NotificationsModuleOverrides,
} from './notifications/notifications.module';
import {
  AdminOperationsModule,
  type AdminOperationsModuleOverrides,
} from './admin-operations/admin-operations.module';
import { PlatformModule } from './platform/platform.module';

@Module({})
export class AppModule {
  public static register(
    config: ApiServiceConfig,
    identityOverrides: IdentityModuleOverrides = {},
    profileOverrides: ProfileModuleOverrides = {},
    catalogOverrides: GameCatalogModuleOverrides = {},
    playerIdentityOverrides: PlayerIdentityModuleOverrides = {},
    matchmakingOverrides: MatchmakingModuleOverrides = {},
    matchesOverrides: MatchesModuleOverrides = {},
    walletOverrides: WalletModuleOverrides = {},
    matchFinanceOverrides: MatchFinanceModuleOverrides = {},
    ratingsOverrides: RatingsModuleOverrides = {},
    notificationsOverrides: NotificationsModuleOverrides = {},
    adminOperationsOverrides: AdminOperationsModuleOverrides = {},
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule,
        ConfigModule.register(config),
        DatabaseModule,
        EmailModule,
        IdentityModule.register(identityOverrides),
        ProfileModule.register(profileOverrides),
        GameCatalogModule.register(catalogOverrides),
        PlayerIdentityModule.register(playerIdentityOverrides),
        MatchFinanceModule.register(matchFinanceOverrides),
        RatingsModule.register(ratingsOverrides),
        NotificationsModule.register(notificationsOverrides),
        AdminOperationsModule.register(adminOperationsOverrides),
        MatchesModule.register(matchesOverrides),
        MatchmakingModule.register(matchmakingOverrides),
        WalletModule.register(walletOverrides),
        HealthModule,
      ],
    };
  }
}
