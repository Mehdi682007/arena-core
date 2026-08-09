'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AppLocale } from './config';
import { uiFormattersFor, uiMessagesFor } from './ui-messages';

const LocaleContext = createContext<AppLocale | null>(null);

export function LocaleProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useUiMessages() {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error('useUiMessages must be used within LocaleProvider');
  }
  return uiMessagesFor(locale);
}

export function useAppLocale() {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error('useAppLocale must be used within LocaleProvider');
  }
  return locale;
}

export function useUiFormatters() {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error('useUiFormatters must be used within LocaleProvider');
  }
  return uiFormattersFor(locale);
}
