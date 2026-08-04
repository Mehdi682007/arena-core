export const supportedLocales = ['fa', 'en'] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = 'fa';

export const localeCookieName = 'arena-locale';

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return supportedLocales.includes(value as AppLocale) ? (value as AppLocale) : defaultLocale;
}

export function localeDirection(locale: AppLocale): 'rtl' | 'ltr' {
  return locale === 'fa' ? 'rtl' : 'ltr';
}
