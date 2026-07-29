import { describe, expect, it } from 'vitest';
import {
  deduplicationKey,
  defaultPreference,
  normalizeLocale,
  validatePayload,
  validatePreference,
} from '../src';
describe('notification policies', () => {
  it('uses stable SHA-256 deduplication and changes with event version', () => {
    const base = {
      recipientUserId: 'u1',
      type: 'RATING_UPDATED' as const,
      sourceType: 'RATING_APPLICATION',
      sourceId: 'r1',
      schemaVersion: 1,
    };
    expect(deduplicationKey(base)).toHaveLength(64);
    expect(deduplicationKey(base)).toBe(deduplicationKey(base));
    expect(deduplicationKey({ ...base, eventVersion: 2 })).not.toBe(deduplicationKey(base));
  });
  it('rejects secrets and prototype pollution keys', () => {
    expect(() => {
      validatePayload({ schemaVersion: 1, data: { accessToken: 'secret' } });
    }).toThrow(/NOTIFICATION_PAYLOAD_INVALID/);
    expect(() => {
      validatePayload({ schemaVersion: 1, data: { constructor: 'bad' } });
    }).toThrow(/NOTIFICATION_PAYLOAD_INVALID/);
  });
  it('enforces defaults, required security channel and locale fallback', () => {
    expect(defaultPreference('RATING_UPDATED').emailEnabled).toBe(false);
    expect(() => {
      validatePreference('SECURITY_SIGN_IN', false, false);
    }).toThrow();
    expect(normalizeLocale('de')).toBe('fa');
  });
});
