'use client';

import { apiRequest, type ApiRequestOptions } from './api-client';

export function browserApi<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>('/api/backend', path, options);
}
