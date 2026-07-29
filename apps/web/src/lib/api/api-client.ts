import { normalizeApiError } from './api-error';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  readonly body?: unknown;
  readonly timeoutMs?: number;
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, timeoutMs = 8_000, headers, ...request } = options;
  const method = request.method?.toUpperCase() ?? 'GET';
  const outgoingHeaders = new Headers(headers);
  outgoingHeaders.set('Accept', 'application/json');
  if (body !== undefined) outgoingHeaders.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    ...request,
    method,
    credentials: 'include',
    ...(method === 'GET' ? (request.cache ? { cache: request.cache } : {}) : { cache: 'no-store' }),
    headers: outgoingHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: request.signal ?? AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw await normalizeApiError(response);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type');
  if (!type?.includes('application/json')) return undefined as T;
  return (await response.json()) as T;
}
