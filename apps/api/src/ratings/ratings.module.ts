import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminRatingService,
  LeaderboardService,
  RatingReconciliationService,
  RatingService,
} from '@arena-core/rating';
import { AdminRatingsController } from './admin/admin-ratings.controller';
import { LeaderboardsController } from './public/leaderboards.controller';
import { RatingsHttpFilter } from './ratings-http.filter';
import { RatingsPermissionGuard } from './ratings-permission.guard';
import {
  ADMIN_RATING_SERVICE,
  LEADERBOARD_SERVICE,
  RATING_RECONCILIATION_SERVICE,
  RATING_SERVICE,
  RATINGS_AUTHORIZATION,
  ratingsProviders,
  type RatingsAuthorization,
} from './ratings.providers';
import { RatingsController } from './user/ratings.controller';

export interface RatingsModuleOverrides {
  ratingService?: RatingService;
  leaderboardService?: LeaderboardService;
  adminService?: AdminRatingService;
  reconciliationService?: RatingReconciliationService;
  authorization?: RatingsAuthorization;
}

@Module({})
export class RatingsModule {
  public static register(overrides: RatingsModuleOverrides = {}): DynamicModule {
    const values = new Map<symbol, object | undefined>([
      [RATING_SERVICE, overrides.ratingService],
      [LEADERBOARD_SERVICE, overrides.leaderboardService],
      [ADMIN_RATING_SERVICE, overrides.adminService],
      [RATING_RECONCILIATION_SERVICE, overrides.reconciliationService],
      [RATINGS_AUTHORIZATION, overrides.authorization],
    ]);
    const replaced = new Set([...values].filter(([, value]) => value).map(([token]) => token));
    const providers: Provider[] = ratingsProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replaced.has(provider.provide as symbol),
    );
    for (const [provide, useValue] of values) if (useValue) providers.push({ provide, useValue });
    return {
      module: RatingsModule,
      controllers: [RatingsController, LeaderboardsController, AdminRatingsController],
      providers: [
        ...providers,
        RatingsPermissionGuard,
        { provide: APP_FILTER, useClass: RatingsHttpFilter },
      ],
    };
  }
}
