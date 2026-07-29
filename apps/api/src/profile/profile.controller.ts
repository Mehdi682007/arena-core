import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Patch, Post } from '@nestjs/common';
import { type UserProfileService } from '@arena-core/identity';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { updateProfileSchema, type UpdateProfileRequest } from './dto/update-profile.dto';
import { profileResponse } from './profile-http.mapper';
import { USER_PROFILE_SERVICE } from './profile.providers';

@Controller()
export class ProfileController {
  public constructor(@Inject(USER_PROFILE_SERVICE) private readonly profiles: UserProfileService) {}

  @Get('profile')
  public async getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<unknown> {
    return profileResponse(await this.profiles.getCurrentUserProfile(principal.userId));
  }

  @Patch('profile')
  public async updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(updateProfileSchema)) input: UpdateProfileRequest,
  ): Promise<unknown> {
    return profileResponse(
      await this.profiles.updateCurrentUserProfile({
        userId: principal.userId,
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
      }),
    );
  }

  @Get('onboarding')
  public async getOnboarding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    return this.profiles.getOnboardingStatus(principal.userId);
  }

  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  public async completeOnboarding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    return this.profiles.completeIdentityOnboarding(principal.userId);
  }
}
