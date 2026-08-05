export type AdminUserStatus =
  'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DISABLED' | 'DELETED';

export type AdminUserSummary = {
  id: string;
  status: AdminUserStatus;
  displayName: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  locale: string | null;
  timezone: string | null;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastAuthenticatedAt: string | null;
  statusChangedAt: string | null;
  suspendedUntil: string | null;
  restrictionReasonCode: string | null;
  restrictionNote: string | null;
};

export type AdminRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount?: number;
  assignedAt?: string;
  expiresAt?: string | null;
  assignedByUserId?: string | null;
  permissions: {
    key: string;
    description: string;
  }[];
};

export type AdminUserLifecycle = {
  canLogin: boolean;
  suspensionExpired: boolean;
  canRestore: boolean;
  canSuspend: boolean;
  canDelete: boolean;
  requiresReview: boolean;
};

export type AdminUserDetail = AdminUserSummary & {
  lifecycle: AdminUserLifecycle;
  securityVersion: number;
  effectivePermissions: string[];
  roles: AdminRole[];
  sessions: {
    id: string;
    status: string;
    createdAt: string;
    lastSeenAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    userAgent: string | null;
  }[];
  counts: {
    sessions: number;
    gameAccounts: number;
    matchParticipants: number;
    notifications: number;
  };
};

export type AdminUserListResponse = {
  items: AdminUserSummary[];
};

export type AdminRoleListResponse = {
  items: AdminRole[];
};
