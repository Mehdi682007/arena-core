import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@arena-core/database';
import { DatabaseService } from '../database/database.service';
import {
  defaultSiteSettings,
  siteSettingsSchema,
  type SiteSettingsValue,
} from './site-settings.dto';
import { SiteAssetService } from './site-asset.service';

function assetUrls(settings: SiteSettingsValue): readonly string[] {
  return [
    settings.brand.logoLight.url,
    settings.brand.logoDark.url,
    settings.brand.faviconUrl,
    settings.brand.openGraphImageUrl,
    settings.landing.heroImageUrl,
  ].filter((url) => url.startsWith('/site-assets/'));
}

@Injectable()
export class SiteSettingsService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly assets: SiteAssetService,
  ) {}

  private client() {
    const client = this.database.getClient();
    if (!client) throw new ServiceUnavailableException('Site settings are unavailable.');
    return client;
  }

  public async published(): Promise<SiteSettingsValue> {
    const row = await this.client().siteSettings.findUnique({ where: { id: 'primary' } });
    return row?.published ? siteSettingsSchema.parse(row.published) : defaultSiteSettings;
  }

  public async draft() {
    const row = await this.client().siteSettings.findUnique({ where: { id: 'primary' } });
    return {
      settings: row ? siteSettingsSchema.parse(row.draft) : defaultSiteSettings,
      version: row?.version ?? 1,
      publishedAt: row?.publishedAt ?? null,
    };
  }

  public async saveDraft(
    actorUserId: string,
    settings: SiteSettingsValue,
    expectedVersion: number,
  ) {
    return this.assets.withMutationLock(async () => {
      const snapshot = siteSettingsSchema.parse(settings);
      const urls = assetUrls(snapshot);
      const committed = await this.assets.commitReferenced(actorUserId, urls);
      try {
        const result = await this.client().$transaction(async (tx) => {
          const existing = await tx.siteSettings.findUnique({ where: { id: 'primary' } });
          if (existing && existing.version !== expectedVersion)
            throw new ConflictException('Site settings version conflict.');
          if (!existing && expectedVersion !== 1)
            throw new ConflictException('Site settings version conflict.');
          const nextVersion = existing ? existing.version + 1 : 1;
          const row = await tx.siteSettings.upsert({
            where: { id: 'primary' },
            create: {
              id: 'primary',
              draft: snapshot as Prisma.InputJsonValue,
              version: nextVersion,
            },
            update: { draft: snapshot as Prisma.InputJsonValue, version: nextVersion },
          });
          await tx.siteSettingsRevision.create({
            data: {
              actorUserId,
              action: 'SAVE_DRAFT',
              version: nextVersion,
              snapshot: snapshot as Prisma.InputJsonValue,
            },
          });
          return {
            settings: siteSettingsSchema.parse(row.draft),
            version: row.version,
            publishedAt: row.publishedAt,
          };
        });
        const current = await this.client().siteSettings.findUnique({ where: { id: 'primary' } });
        const references = new Set<string>();
        if (current) {
          for (const value of [current.draft, current.published]) {
            if (value)
              for (const url of assetUrls(siteSettingsSchema.parse(value))) references.add(url);
          }
        }
        await this.assets.cleanupCommitted(references).catch(() => undefined);
        await this.assets.cleanupStaged().catch(() => undefined);
        return result;
      } catch (error) {
        await this.assets.rollbackCommitted(committed);
        throw error;
      }
    });
  }

  public async publish(actorUserId: string, expectedVersion: number) {
    return this.assets.withMutationLock(async () => {
      const result = await this.client().$transaction(async (tx) => {
        const existing = await tx.siteSettings.findUnique({ where: { id: 'primary' } });
        if (!existing || existing.version !== expectedVersion)
          throw new ConflictException('Site settings version conflict.');
        const now = new Date();
        const nextVersion = existing.version + 1;
        const published = siteSettingsSchema.parse(existing.draft) as Prisma.InputJsonValue;
        const row = await tx.siteSettings.update({
          where: { id: 'primary' },
          data: { published, publishedAt: now, version: nextVersion },
        });
        await tx.siteSettingsRevision.create({
          data: { actorUserId, action: 'PUBLISH', version: nextVersion, snapshot: published },
        });
        return {
          settings: siteSettingsSchema.parse(row.published),
          version: row.version,
          publishedAt: row.publishedAt,
        };
      });
      const current = await this.client().siteSettings.findUnique({ where: { id: 'primary' } });
      const references = new Set<string>();
      if (current) {
        for (const value of [current.draft, current.published]) {
          if (value)
            for (const url of assetUrls(siteSettingsSchema.parse(value))) references.add(url);
        }
      }
      await this.assets.cleanupCommitted(references).catch(() => undefined);
      await this.assets.cleanupStaged().catch(() => undefined);
      return result;
    });
  }
}
