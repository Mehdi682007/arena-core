import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const sql = readFileSync(
  join(process.cwd(), 'prisma/migrations/20260728120000_create_match_settlements/migration.sql'),
  'utf8',
);
describe('match settlement migration', () => {
  it('defines settlement models and non-monetary transaction types', () => {
    expect(schema).toContain('model MatchSettlement');
    expect(schema).toContain('enum MatchSettlementStatus');
    expect(schema).toContain('MATCH_WINNER_SETTLEMENT');
    expect(schema).toContain('MATCH_DRAW_REFUND');
    expect(schema).toContain('MATCH_VOID_REFUND');
  });
  it('enforces immutable accounting equations and zero retention', () => {
    expect(sql).toContain(
      '"total_escrow_amount" = "distributed_amount" + "refunded_amount" + "retained_amount"',
    );
    expect(sql).toContain('"retained_amount" = 0');
    expect(sql).toContain('"asset_code" = \'ARENA_POINT\'');
    expect(sql).toContain('match_settlements_match_id_key');
  });
  it('contains no fee, commission, provider or real-money columns', () => {
    expect(sql).not.toMatch(/\b(platform_fee|commission|cash|payment_provider|exchange_rate)\b/i);
  });
});
