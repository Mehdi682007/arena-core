import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  PrismaUserProfileRepository,
  ProfileError,
  UserProfileService,
  type IdentityOnboardingState,
  type UpsertUserProfileRecord,
  type UserProfileRecord,
  type UserProfileRepository,
} from '@arena-core/identity';
import { DatabaseService } from '../database/database.service';

export const USER_PROFILE_SERVICE = Symbol('USER_PROFILE_SERVICE');

@Injectable()
class ApiUserProfileRepository implements UserProfileRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  public findProfileByUserId(userId: string): Promise<UserProfileRecord | null> {
    return this.repository().findProfileByUserId(userId);
  }

  public upsertProfile(input: UpsertUserProfileRecord): Promise<UserProfileRecord> {
    return this.repository().upsertProfile(input);
  }

  public findIdentityOnboardingState(userId: string): Promise<IdentityOnboardingState | null> {
    return this.repository().findIdentityOnboardingState(userId);
  }

  private repository(): PrismaUserProfileRepository {
    const client = this.database.getClient();
    if (client === undefined) throw new ProfileError('PROFILE_DATABASE_DISABLED');
    return new PrismaUserProfileRepository(client);
  }
}

export const profileProviders: Provider[] = [
  ApiUserProfileRepository,
  {
    provide: USER_PROFILE_SERVICE,
    inject: [ApiUserProfileRepository],
    useFactory: (repository: ApiUserProfileRepository) => new UserProfileService(repository),
  },
];
