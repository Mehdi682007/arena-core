import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import type { PublicGameCatalogService } from '@arena-core/game-catalog';
import { Public } from '../identity/http/decorators/public.decorator';
import { PUBLIC_CATALOG_SERVICE } from './catalog.providers';
import type { HttpResponse } from '../identity/http/identity-http.types';

@Public()
@Controller('catalog/games')
export class PublicCatalogController {
  public constructor(
    @Inject(PUBLIC_CATALOG_SERVICE) private readonly catalog: PublicGameCatalogService,
  ) {}
  @Get()
  public async list(@Res({ passthrough: true }) response: HttpResponse): Promise<unknown> {
    publicCache(response);
    return { games: await this.catalog.listGames() };
  }
  @Get(':slug')
  public get(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<unknown> {
    publicCache(response);
    return this.catalog.getGame(slug);
  }
  @Get(':slug/rulesets/default')
  public getDefaultRuleset(
    @Param('slug') slug: string,
    @Query('modeKey') modeKey: string | undefined,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<unknown> {
    publicCache(response);
    return this.catalog.getDefaultRuleset(slug, modeKey);
  }
}

function publicCache(response: HttpResponse): void {
  response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  response.setHeader('Pragma', '');
}
