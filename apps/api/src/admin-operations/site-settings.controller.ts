import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { Public } from '../identity/http/decorators/public.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { AllowMultipartFormData } from '../identity/http/identity-security.guard';
import {
  AdminOperationsPermissionGuard,
  RequireAdminOperationsPermission,
} from './admin-operations-permission.guard';
import {
  siteSettingsPublishSchema,
  siteSettingsUpdateSchema,
  type SiteSettingsValue,
} from './site-settings.dto';
import { SiteSettingsService } from './site-settings.service';
import { SiteAssetService, type SiteAssetField, type SiteAssetFile } from './site-asset.service';

@Public()
@Controller('site-settings')
export class PublicSiteSettingsController {
  public constructor(private readonly settings: SiteSettingsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  public get() {
    return this.settings.published();
  }
}

@Public()
@Controller('site-assets')
export class PublicSiteAssetController {
  public constructor(private readonly assets: SiteAssetService) {}
  @Get(':id')
  public async get(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const asset = await this.assets.read(id);
    response.setHeader('Content-Type', asset.mime);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(asset.buffer);
  }
}

@Controller('admin/settings/site')
@UseGuards(AdminOperationsPermissionGuard)
export class AdminSiteSettingsController {
  public constructor(
    private readonly settings: SiteSettingsService,
    private readonly assets: SiteAssetService,
  ) {}
  @Get()
  @RequireAdminOperationsPermission('site_settings.read')
  public get() {
    return this.settings.draft();
  }
  @Put()
  @RequireAdminOperationsPermission('site_settings.manage')
  public save(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(siteSettingsUpdateSchema))
    body: { settings: SiteSettingsValue; expectedVersion: number },
  ) {
    return this.settings.saveDraft(actor.userId, body.settings, body.expectedVersion);
  }
  @Post('publish')
  @RequireAdminOperationsPermission('site_settings.manage')
  public publish(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(siteSettingsPublishSchema)) body: { expectedVersion: number },
  ) {
    return this.settings.publish(actor.userId, body.expectedVersion);
  }
  @Post('assets')
  @AllowMultipartFormData()
  @RequireAdminOperationsPermission('site_settings.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  public upload(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body('field') field?: string,
    @UploadedFile() file?: SiteAssetFile,
  ) {
    if (!file) throw new BadRequestException('Asset file is required.');
    if (
      !field ||
      !['logoLight', 'logoDark', 'faviconUrl', 'openGraphImageUrl', 'heroImageUrl'].includes(field)
    )
      throw new BadRequestException('Asset field is invalid.');
    return this.assets.stage(actor.userId, field as SiteAssetField, file);
  }
}
