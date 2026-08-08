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
import { browserApi } from '@/lib/api/browser-api-client';

export function LanguageToggle({
  initialLocale,
  compact = false,
  persistProfile = false,
}: {
  initialLocale?: AppLocale;
  compact?: boolean;
  persistProfile?: boolean;
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

  async function changeLocale(nextLocale: AppLocale): Promise<void> {
    if (nextLocale === locale) {
      return;
    }

    if (persistProfile) {
      try {
        await browserApi('/profile', {
          method: 'PATCH',
          body: { locale: nextLocale },
        });
      } catch {
        return;
      }
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
  }

  return (
    <div className="language-toggle" data-compact={compact ? 'true' : 'false'}>
      <Globe2 aria-hidden="true" />

      <button
        aria-label="تغییر زبان به فارسی"
        aria-pressed={locale === 'fa'}
        className={locale === 'fa' ? 'is-active' : undefined}
        onClick={() => {
          void changeLocale('fa');
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
          void changeLocale('en');
        }}
        type="button"
      >
        English
      </button>
    </div>
  );
}
