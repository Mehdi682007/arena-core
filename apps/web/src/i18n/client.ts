import { localeCookieName, localeDirection, type AppLocale } from './config';

export function persistClientLocale(locale: AppLocale): void {
  document.cookie = [
    `${localeCookieName}=${locale}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    window.location.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
}
