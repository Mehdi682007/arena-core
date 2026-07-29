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
