'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'arena-admin-theme';
const THEME_EVENT = 'arena-admin-theme-change';

const readTheme = (): Theme => {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getServerTheme = (): Theme => 'light';

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

const subscribe = (onStoreChange: () => void) => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(readTheme());
      onStoreChange();
    }
  };

  const handleThemeChange = () => {
    applyTheme(readTheme());
    onStoreChange();
  };

  const handleSystemThemeChange = () => {
    if (window.localStorage.getItem(STORAGE_KEY) === null) {
      applyTheme(readTheme());
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(THEME_EVENT, handleThemeChange);
  media.addEventListener('change', handleSystemThemeChange);

  applyTheme(readTheme());

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(THEME_EVENT, handleThemeChange);
    media.removeEventListener('change', handleSystemThemeChange);
  };
};

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme);

  const dark = theme === 'dark';

  const toggleTheme = () => {
    const nextTheme: Theme = dark ? 'light' : 'dark';

    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      className="admin-theme-toggle"
      onClick={toggleTheme}
      aria-label={dark ? 'فعال‌کردن حالت روشن' : 'فعال‌کردن حالت تاریک'}
      aria-pressed={dark}
      title={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
    >
      <span className="admin-theme-toggle-icon" aria-hidden="true">
        {dark ? '☀' : '☾'}
      </span>

      <span className="admin-theme-toggle-label">{dark ? 'روشن' : 'تاریک'}</span>
    </button>
  );
}
