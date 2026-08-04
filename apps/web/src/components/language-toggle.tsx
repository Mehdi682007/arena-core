'use client';

import { Globe2 } from 'lucide-react';
import { useState } from 'react';
import {
  defaultLocale,
  localeCookieName,
  localeDirection,
  normalizeLocale,
  type AppLocale,
} from '@/i18n/config';

export function LanguageToggle({
  initialLocale,
  compact = false,
}: {
  initialLocale?: AppLocale;
  compact?: boolean;
}) {
  const [locale, setLocale] = useState<AppLocale>(() => {
    if (initialLocale) {
      return initialLocale;
    }

    if (typeof document !== 'undefined') {
      return normalizeLocale(document.documentElement.lang);
    }

    return defaultLocale;
  });

  const changeLocale = (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = [
      `${localeCookieName}=${nextLocale}`,
      'Path=/',
      'Max-Age=31536000',
      'SameSite=Lax',
      window.location.protocol === 'https:' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    document.documentElement.lang = nextLocale;
    document.documentElement.dir = localeDirection(nextLocale);

    setLocale(nextLocale);
    window.location.reload();
  };

  return (
    <div className="language-toggle" data-compact={compact ? 'true' : 'false'}>
      <Globe2 aria-hidden="true" />

      <button
        aria-label="تغییر زبان به فارسی"
        aria-pressed={locale === 'fa'}
        className={locale === 'fa' ? 'is-active' : undefined}
        onClick={() => {
          changeLocale('fa');
        }}
        type="button"
      >
        فارسی
      </button>

      <span aria-hidden="true">/</span>

      <button
        aria-label="Switch language to English"
        aria-pressed={locale === 'en'}
        className={locale === 'en' ? 'is-active' : undefined}
        onClick={() => {
          changeLocale('en');
        }}
        type="button"
      >
        English
      </button>
    </div>
  );
}
