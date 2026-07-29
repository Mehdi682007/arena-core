import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { UserProfileService } from '@arena-core/identity';
import { ProfileController } from './profile.controller';
import { profileProviders, USER_PROFILE_SERVICE } from './profile.providers';

export interface ProfileModuleOverrides {
  readonly service?: UserProfileService;
}

@Module({})
export class ProfileModule {
  public static register(overrides: ProfileModuleOverrides = {}): DynamicModule {
    const providers: Provider[] =
      overrides.service === undefined
        ? profileProviders
        : [{ provide: USER_PROFILE_SERVICE, useValue: overrides.service }];
    return {
      module: ProfileModule,
      controllers: [ProfileController],
      providers,
    };
  }
}
