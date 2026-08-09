export type ServiceName = 'web' | 'api' | 'worker';

export interface ServiceHealth {
  service: ServiceName;
  status: 'ok';
  version: string;
  environment: string;
}

export interface HttpServiceHealth extends ServiceHealth {
  service: 'web' | 'api';
  timestamp: string;
}

export interface ApiReadiness {
  service: 'api';
  status: 'ready' | 'not_ready';
  dependencies: {
    database: 'disabled' | 'up' | 'down';
  };
  timestamp: string;
}

export interface WorkerServiceHealth extends ServiceHealth {
  service: 'worker';
  startedAt: string;
  database: 'disabled' | 'up';
}

export const GAME_ACCOUNT_REJECTION_REASON_CODES = [
  'HANDLE_NOT_FOUND',
  'OWNERSHIP_NOT_PROVEN',
  'DUPLICATE_ACCOUNT',
  'INVALID_PLATFORM',
  'INSUFFICIENT_INFORMATION',
  'OTHER',
] as const;

export const GAME_ACCOUNT_SUSPENSION_REASON_CODES = [
  'OWNERSHIP_DISPUTE',
  'ACCOUNT_TRANSFERRED',
  'POLICY_VIOLATION',
  'SECURITY_REVIEW',
  'OTHER',
] as const;

export type GameAccountRejectionReasonCode = (typeof GAME_ACCOUNT_REJECTION_REASON_CODES)[number];
export type GameAccountSuspensionReasonCode = (typeof GAME_ACCOUNT_SUSPENSION_REASON_CODES)[number];
