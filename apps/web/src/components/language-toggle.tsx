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

function persistLocaleCookie(locale: AppLocale): void {
  document.cookie = [
    `${localeCookieName}=${locale}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    window.location.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

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
  const [pending, setPending] = useState(false);

  const changeLocale = async (nextLocale: AppLocale) => {
    if (nextLocale === locale || pending) {
      return;
    }

    setPending(true);
    if (persistProfile) {
      try {
        await browserApi('/profile', { method: 'PATCH', body: { locale: nextLocale } });
      } catch {
        // The cookie remains a valid per-device preference even if account persistence is unavailable.
      }
    }

    persistLocaleCookie(nextLocale);
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
        disabled={pending}
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
        disabled={pending}
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
