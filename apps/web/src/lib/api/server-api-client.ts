import 'server-only';
import { cookies } from 'next/headers';
import { getWebConfig } from '@/config';
import { apiRequest, type ApiRequestOptions } from './api-client';

export async function serverApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const cookie = (await cookies()).toString();
  const headers = new Headers(options.headers);
  if (cookie) headers.set('cookie', cookie);
  return apiRequest<T>(getWebConfig().server.apiBaseUrl, path, {
    ...options,
    cache: 'no-store',
    headers,
  });
}
