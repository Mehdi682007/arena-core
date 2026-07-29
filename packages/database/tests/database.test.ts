import { describe, expect, it, vi } from 'vitest';
import {
  DatabaseError,
  checkDatabaseConnection,
  classifyDatabaseError,
  connectPrisma,
  disconnectPrisma,
  sanitizeDatabaseError,
} from '../src';

describe('database foundation', () => {
  it.each([
    ['P1000', 'authentication'],
    ['P1001', 'connection'],
    ['P1002', 'timeout'],
    ['P2002', 'constraint'],
    ['P2025', 'not-found'],
    ['P2034', 'conflict'],
    ['other', 'unknown'],
  ])('classifies %s without returning raw error details', (code, kind) => {
    expect(classifyDatabaseError({ code, message: 'secret connection string' })).toBe(kind);
  });

  it('sanitizes errors without retaining credentials', () => {
    const error = sanitizeDatabaseError(
      new Error('postgresql://user:password@example.test/database'),
    );
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe('Database operation failed.');
    expect(String(error)).not.toContain('password');
  });

  it('connects only when explicitly requested', async () => {
    const client = { $connect: vi.fn(() => Promise.resolve()) };
    expect(client.$connect).not.toHaveBeenCalled();
    await connectPrisma(client);
    expect(client.$connect).toHaveBeenCalledOnce();
  });

  it('disconnects idempotently', async () => {
    const client = { $disconnect: vi.fn(() => Promise.resolve()) };
    await disconnectPrisma(client);
    await disconnectPrisma(client);
    expect(client.$disconnect).toHaveBeenCalledOnce();
  });

  it('runs a side-effect-free connection probe', async () => {
    const client = { $queryRaw: vi.fn(() => Promise.resolve([{ '?column?': 1 }])) };
    await checkDatabaseConnection(client);
    expect(client.$queryRaw).toHaveBeenCalledOnce();
  });

  it('rejects a failed connection probe', async () => {
    const client = {
      $queryRaw: vi.fn(async () => Promise.reject(new Error('connection unavailable'))),
    };
    await expect(checkDatabaseConnection(client)).rejects.toThrow(/connection unavailable/);
  });

  it('times out a stalled probe and clears the timer', async () => {
    vi.useFakeTimers();
    const probe = checkDatabaseConnection(
      { $queryRaw: async () => new Promise(() => undefined) },
      10,
    );
    const assertion = expect(probe).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    vi.useRealTimers();
  });
});
