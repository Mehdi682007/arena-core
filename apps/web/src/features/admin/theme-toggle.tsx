'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { AppLocale } from '@/i18n/config';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'arena-theme';
const THEME_EVENT = 'arena-theme-change';

const readPreference = (): ThemePreference => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : preference;

export const applyThemePreference = (preference: ThemePreference): void => {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
};

const subscribe = (onStoreChange: () => void) => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    applyThemePreference(readPreference());
    onStoreChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) update();
  };

  window.addEventListener('storage', storage);
  window.addEventListener(THEME_EVENT, update);
  media.addEventListener('change', update);
  applyThemePreference(readPreference());

  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(THEME_EVENT, update);
    media.removeEventListener('change', update);
  };
};

const getServerPreference = (): ThemePreference => 'system';

export function ThemeToggle({ locale: _locale = 'fa' }: { locale?: AppLocale }) {
  void _locale;
  const ui = useUiMessages();
  const preference = useSyncExternalStore(subscribe, readPreference, getServerPreference);
  const labels = { group: ui.theme, light: ui.light, dark: ui.dark, system: ui.system };

  const options = [
    { value: 'light' as const, icon: Sun },
    { value: 'dark' as const, icon: Moon },
    { value: 'system' as const, icon: Monitor },
  ];

  return (
    <div className="theme-switcher" role="group" aria-label={labels.group}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className="admin-theme-toggle"
          data-active={preference === value}
          aria-pressed={preference === value}
          aria-label={labels[value]}
          title={labels[value]}
          onClick={() => {
            window.localStorage.setItem(THEME_STORAGE_KEY, value);
            applyThemePreference(value);
            window.dispatchEvent(new Event(THEME_EVENT));
          }}
        >
          <Icon className="admin-theme-toggle-icon" aria-hidden="true" />
          <span className="admin-theme-toggle-label">{labels[value]}</span>
        </button>
      ))}
    </div>
  );
}
