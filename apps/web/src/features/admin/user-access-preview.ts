import type {
  AdminRole,
  AdminRoleListResponse,
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserSummary,
} from './user-access-types';

export const ADMIN_PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000902';

const now = new Date();

const previewPrimaryUser: AdminUserSummary = {
  id: ADMIN_PREVIEW_USER_ID,
  status: 'ACTIVE',
  deletedAt: null,
  displayName: 'کاربر نمونه Arena',
  email: 'player@example.com',
  emailVerifiedAt: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
  locale: 'fa',
  timezone: 'Asia/Tehran',
  countryCode: 'IR',
  createdAt: new Date(now.getTime() - 120 * 86_400_000).toISOString(),
  updatedAt: now.toISOString(),
  lastAuthenticatedAt: new Date(now.getTime() - 25 * 60_000).toISOString(),
  statusChangedAt: null,
  suspendedUntil: null,
  restrictionReasonCode: null,
  restrictionNote: null,
};

const previewSuspendedUser: AdminUserSummary = {
  id: '00000000-0000-4000-8000-000000000903',
  status: 'SUSPENDED',
  deletedAt: null,
  displayName: 'بازیکن تحت بررسی',
  email: 'review@example.com',
  emailVerifiedAt: new Date(now.getTime() - 60 * 86_400_000).toISOString(),
  locale: 'fa',
  timezone: 'Asia/Tehran',
  countryCode: 'IR',
  createdAt: new Date(now.getTime() - 200 * 86_400_000).toISOString(),
  updatedAt: now.toISOString(),
  lastAuthenticatedAt: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
  statusChangedAt: new Date(now.getTime() - 86_400_000).toISOString(),
  suspendedUntil: new Date(now.getTime() + 6 * 86_400_000).toISOString(),
  restrictionReasonCode: 'ADMIN_REVIEW',
  restrictionNote: 'بررسی گزارش‌های ثبت‌شده',
};

export const ADMIN_USER_PREVIEW_LIST: AdminUserListResponse = {
  items: [previewPrimaryUser, previewSuspendedUser],
};

const previewSupportRole: AdminRole = {
  id: '00000000-0000-4000-8000-000000000910',
  key: 'SUPPORT_AGENT',
  name: 'اپراتور پشتیبانی',
  description: 'دسترسی محدود به عملیات پشتیبانی',
  isSystem: false,
  userCount: 3,
  permissions: [
    {
      key: 'users.read',
      description: 'مشاهده کاربران',
    },
    {
      key: 'timeline.read',
      description: 'مشاهده خط زمانی',
    },
  ],
};

const previewSuperAdminRole: AdminRole = {
  id: '00000000-0000-4000-8000-000000000911',
  key: 'SUPER_ADMIN',
  name: 'مدیر ارشد',
  description: 'مدیریت کامل سامانه',
  isSystem: true,
  userCount: 2,
  permissions: [
    {
      key: 'users.manage_status',
      description: 'مدیریت وضعیت کاربران',
    },
    {
      key: 'roles.assign',
      description: 'تخصیص نقش',
    },
  ],
};

export const ADMIN_USER_PREVIEW_ROLES: AdminRoleListResponse = {
  items: [previewSupportRole, previewSuperAdminRole],
};

export const ADMIN_USER_PREVIEW_DETAIL: AdminUserDetail = {
  ...previewPrimaryUser,
  securityVersion: 4,
  effectivePermissions: ['notifications.read', 'timeline.read'],
  roles: [
    {
      ...previewSupportRole,
      assignedAt: new Date(now.getTime() - 45 * 86_400_000).toISOString(),
      expiresAt: null,
      assignedByUserId: '00000000-0000-4000-8000-000000000901',
    },
  ],
  sessions: [
    {
      id: '00000000-0000-4000-8000-000000000920',
      status: 'ACTIVE',
      createdAt: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      lastSeenAt: new Date(now.getTime() - 25 * 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 23 * 86_400_000).toISOString(),
      revokedAt: null,
      revocationReason: null,
      userAgent: 'Chrome / Windows',
    },
  ],
  counts: {
    sessions: 2,
    gameAccounts: 1,
    matchParticipants: 18,
    notifications: 37,
  },
};
