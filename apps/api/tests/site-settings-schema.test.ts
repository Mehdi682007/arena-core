import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultSiteSettings, siteSettingsSchema } from '../src/admin-operations/site-settings.dto';

describe('site settings schema', () => {
  it('accepts the safe bilingual defaults', () => {
    expect(siteSettingsSchema.parse(defaultSiteSettings).brand.primaryColor).toBe('#3157d5');
  });

  it('rejects script and insecure external URLs', () => {
    expect(() =>
      siteSettingsSchema.parse({
        ...defaultSiteSettings,
        brand: { ...defaultSiteSettings.brand, termsUrl: 'javascript:alert(1)' },
      }),
    ).toThrow();
    expect(() =>
      siteSettingsSchema.parse({
        ...defaultSiteSettings,
        landing: { ...defaultSiteSettings.landing, heroImageUrl: 'http://example.com/image.png' },
      }),
    ).toThrow();
  });

  it('rejects protocol-relative, credential-bearing, traversal-like and data URLs', () => {
    for (const unsafe of [
      '//attacker.example/logo.png',
      'https://user:password@example.com/logo.png',
      '/assets\\..\\secret',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ]) {
      expect(() =>
        siteSettingsSchema.parse({
          ...defaultSiteSettings,
          brand: {
            ...defaultSiteSettings.brand,
            logoLight: { ...defaultSiteSettings.brand.logoLight, url: unsafe },
          },
        }),
      ).toThrow();
    }
  });

  it('rejects invalid announcement windows and duplicate section keys', () => {
    expect(() =>
      siteSettingsSchema.parse({
        ...defaultSiteSettings,
        landing: {
          ...defaultSiteSettings.landing,
          announcement: {
            enabled: true,
            message: { fa: 'x', en: 'x' },
            startsAt: '2026-08-10T00:00:00.000Z',
            endsAt: '2026-08-09T00:00:00.000Z',
          },
        },
      }),
    ).toThrow();
    const section = {
      key: 'features',
      visible: true,
      title: { fa: 'x', en: 'x' },
      description: { fa: '', en: '' },
      order: 1,
    };
    expect(() =>
      siteSettingsSchema.parse({
        ...defaultSiteSettings,
        landing: { ...defaultSiteSettings.landing, sections: [section, section] },
      }),
    ).toThrow();
  });

  it('keeps uploads behind the manage permission and never trusts original names as paths', () => {
    const controller = readFileSync(
      resolve(import.meta.dirname, '../src/admin-operations/site-settings.controller.ts'),
      'utf8',
    );
    const assets = readFileSync(
      resolve(import.meta.dirname, '../src/admin-operations/site-asset.service.ts'),
      'utf8',
    );
    expect(controller).toContain("@RequireAdminOperationsPermission('site_settings.manage')");
    expect(controller).toContain("FileInterceptor('file'");
    expect(assets).toContain('randomUUID()');
    expect(assets).toContain('basename(file.originalname)');
    expect(assets).toContain('limitInputPixels');
  });
});
