import 'server-only';

import { cookies } from 'next/headers';
import { localeCookieName, normalizeLocale, type AppLocale } from './config';
import { messagesFor, type AppMessages } from './messages';

export async function getServerLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value);
}

export async function getServerMessages(): Promise<{
  readonly locale: AppLocale;
  readonly messages: AppMessages;
}> {
  const locale = await getServerLocale();
  return { locale, messages: messagesFor(locale) };
}
