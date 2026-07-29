import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = resolve(__dirname, '../../..');
const schema = readFileSync(resolve(root, 'packages/database/prisma/schema.prisma'), 'utf8');
const sql = readFileSync(
  resolve(
    root,
    'packages/database/prisma/migrations/20260730120000_create_notifications_and_delivery_outbox/migration.sql',
  ),
  'utf8',
);
describe('notification migration', () => {
  it('contains all models and uniqueness constraints', () => {
    for (const model of [
      'Notification',
      'NotificationPreference',
      'NotificationOutboxMessage',
      'NotificationDeliveryAttempt',
    ])
      expect(schema).toContain(`model ${model}`);
    expect(sql).toContain('notifications_deduplication_key');
    expect(sql).toContain('notification_preferences_user_type_key');
    expect(sql).toContain('notification_outbox_notification_channel_key');
    expect(sql).toContain('notification_delivery_attempts_outbox_number_key');
  });
  it('has no queue, push, sms, or webhook tables', () => {
    expect(sql).not.toMatch(/CREATE TABLE "(?:Queue|Push|Sms|Webhook)/i);
  });
});
