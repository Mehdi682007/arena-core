export type DatabaseErrorKind =
  'connection' | 'authentication' | 'timeout' | 'constraint' | 'not-found' | 'conflict' | 'unknown';

export class DatabaseError extends Error {
  public constructor(
    public readonly kind: DatabaseErrorKind,
    message = 'Database operation failed.',
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

const codeKinds: Readonly<Record<string, DatabaseErrorKind>> = {
  P1000: 'authentication',
  P1001: 'connection',
  P1002: 'timeout',
  P1008: 'timeout',
  P2002: 'constraint',
  P2003: 'constraint',
  P2025: 'not-found',
  P2034: 'conflict',
};

export function classifyDatabaseError(error: unknown): DatabaseErrorKind {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);
    if (code in codeKinds) return codeKinds[code] ?? 'unknown';
  }
  if (error instanceof Error && /timed out|timeout/i.test(error.message)) return 'timeout';
  return 'unknown';
}

export function sanitizeDatabaseError(error: unknown): DatabaseError {
  return new DatabaseError(classifyDatabaseError(error));
}
