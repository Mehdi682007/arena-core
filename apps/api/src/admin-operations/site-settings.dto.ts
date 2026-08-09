import { z } from 'zod';

const text = (maximum: number) => z.string().trim().max(maximum);
const isSafeUrl = (value: string): boolean => {
  if (value === '') return true;
  if (/^\/(?!\/)/.test(value)) {
    if (value.includes('\\')) return false;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit <= 31 || codeUnit === 127) return false;
    }
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
};
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isSafeUrl, 'Only same-origin paths and HTTPS URLs are allowed.');
const localizedText = z.object({ fa: text(500), en: text(500) }).strict();
const asset = z.object({ url: safeUrl, alt: localizedText }).strict();

export const siteSettingsSchema = z
  .object({
    brand: z
      .object({
        siteName: localizedText,
        shortTitle: localizedText,
        description: localizedText,
        logoLight: asset,
        logoDark: asset,
        faviconUrl: safeUrl,
        openGraphImageUrl: safeUrl,
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        supportEmail: z.email().max(320).or(z.literal('')),
        termsUrl: safeUrl,
        privacyUrl: safeUrl,
        copyright: localizedText,
        footer: localizedText,
        socialLinks: z.array(z.object({ label: localizedText, url: safeUrl }).strict()).max(10),
      })
      .strict(),
    landing: z
      .object({
        heroTitle: localizedText,
        heroSubtitle: localizedText,
        primaryAction: z.object({ label: localizedText, url: safeUrl }).strict(),
        secondaryAction: z.object({ label: localizedText, url: safeUrl }).strict(),
        heroImageUrl: safeUrl,
        sections: z
          .array(
            z
              .object({
                key: z.enum(['identity', 'rankings', 'notifications']),
                visible: z.boolean(),
                title: localizedText,
                description: localizedText,
                order: z.number().int().min(0).max(100),
              })
              .strict(),
          )
          .max(12),
        announcement: z
          .object({
            enabled: z.boolean(),
            message: localizedText,
            url: safeUrl.default(''),
            severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).default('INFO'),
            startsAt: z.iso.datetime().nullable(),
            endsAt: z.iso.datetime().nullable(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const { startsAt, endsAt } = value.landing.announcement;
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['landing', 'announcement', 'endsAt'],
        message: 'End date must be after start date.',
      });
    }
    const keys = value.landing.sections.map((section) => section.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: 'custom',
        path: ['landing', 'sections'],
        message: 'Section keys must be unique.',
      });
    }
  });

export const siteSettingsUpdateSchema = z
  .object({ settings: siteSettingsSchema, expectedVersion: z.number().int().positive() })
  .strict();
export const siteSettingsPublishSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export type SiteSettingsValue = z.infer<typeof siteSettingsSchema>;

export const defaultSiteSettings: SiteSettingsValue = siteSettingsSchema.parse({
  brand: {
    siteName: { fa: 'آرنا کور', en: 'Arena Core' },
    shortTitle: { fa: 'آرنا', en: 'Arena' },
    description: { fa: 'بستر رقابت آنلاین شفاف', en: 'A transparent online competition platform' },
    logoLight: { url: '', alt: { fa: 'آرنا کور', en: 'Arena Core' } },
    logoDark: { url: '', alt: { fa: 'آرنا کور', en: 'Arena Core' } },
    faviconUrl: '',
    openGraphImageUrl: '',
    primaryColor: '#3157d5',
    accentColor: '#7c3aed',
    supportEmail: '',
    termsUrl: '',
    privacyUrl: '',
    copyright: { fa: 'تمام حقوق محفوظ است.', en: 'All rights reserved.' },
    footer: { fa: 'رقابت شفاف و منصفانه', en: 'Transparent and fair competition' },
    socialLinks: [],
  },
  landing: {
    heroTitle: { fa: 'رقابت را حرفه‌ای تجربه کنید', en: 'Compete with confidence' },
    heroSubtitle: {
      fa: 'هویت بازی خود را ثبت کنید و وارد رقابت شوید.',
      en: 'Register your game identity and join the competition.',
    },
    primaryAction: { label: { fa: 'شروع کنید', en: 'Get started' }, url: '/register' },
    secondaryAction: { label: { fa: 'جدول رتبه‌بندی', en: 'Leaderboards' }, url: '/leaderboards' },
    heroImageUrl: '',
    sections: [],
    announcement: {
      enabled: false,
      message: { fa: '', en: '' },
      url: '',
      severity: 'INFO',
      startsAt: null,
      endsAt: null,
    },
  },
});
