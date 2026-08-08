'use client';

import { apiRequest, type ApiRequestOptions } from './api-client';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function browserApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET';
  const normalizedOptions =
    writeMethods.has(method) && options.body === undefined ? { ...options, body: {} } : options;

  return apiRequest<T>('/api/backend', path, normalizedOptions);
}
