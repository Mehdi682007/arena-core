import 'server-only';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/api-error';
import { adminApi } from './api';
import type { AdminPermission } from './types';

import { isAdminUiPreviewEnabled } from './preview';
export type AdminAccess =
  | { status: 'allowed'; permissions: AdminPermission[] }
  | { status: 'forbidden' }
  | { status: 'unavailable'; requestId?: string };

export async function getAdminAccess(): Promise<AdminAccess> {
  try {
    const result = await adminApi.capabilities();
    return result.permissions.length
      ? { status: 'allowed', permissions: result.permissions }
      : { status: 'forbidden' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { status: 'forbidden' };
    return {
      status: 'unavailable',
      ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
    };
  }
}

export async function requireAdminPermission(permission: AdminPermission): Promise<void> {
  if (isAdminUiPreviewEnabled()) {
    return;
  }
  const access = await getAdminAccess();
  if (access.status !== 'allowed' || !access.permissions.includes(permission)) {
    redirect('/admin?permission=denied');
  }
}

export async function requireAnyAdminPermission(
  permissions: readonly AdminPermission[],
): Promise<AdminPermission[]> {
  const access = await getAdminAccess();
  if (
    access.status !== 'allowed' ||
    !permissions.some((item) => access.permissions.includes(item))
  ) {
    redirect('/admin?permission=denied');
  }
  return access.permissions;
}
