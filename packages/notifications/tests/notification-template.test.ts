import { describe, expect, it } from 'vitest';
import { renderNotificationTemplate } from '../src';
describe('notification templates', () => {
  it('renders deterministic fa/en snapshots', () => {
    const payload = { schemaVersion: 1 as const, data: { game: 'FC 26', rating: 1040, delta: 40 } };
    expect(renderNotificationTemplate('RATING_UPDATED', 'en', payload)).toEqual(
      renderNotificationTemplate('RATING_UPDATED', 'en', payload),
    );
    expect(renderNotificationTemplate('RATING_UPDATED', 'fa', payload).subject).not.toBe('');
  });
  it('escapes user-controlled text in server-generated HTML', () => {
    const result = renderNotificationTemplate('RATING_UPDATED', 'en', {
      schemaVersion: 1,
      data: { game: '<img src=x onerror=alert(1)>', rating: 1, delta: 1 },
    });
    expect(result.email?.html).toContain('&lt;img');
    expect(result.email?.html).not.toContain('<img');
  });
});
