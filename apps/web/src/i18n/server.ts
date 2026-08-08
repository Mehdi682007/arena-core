import { cookies } from 'next/headers';
import { localeCookieName, normalizeLocale, type AppLocale } from './config';

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();

  return normalizeLocale(cookieStore.get(localeCookieName)?.value);
}
