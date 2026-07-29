import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260727100000_create_wallet_ledger/migration.sql'),
  'utf8',
);
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
describe('F5.1 wallet migration', () => {
  it('creates the complete ledger model and integrity guards', () => {
    for (const table of [
      'wallets',
      'ledger_accounts',
      'ledger_transactions',
      'ledger_entries',
      'wallet_audit_events',
    ])
      expect(sql).toContain(`"${table}"`);
    expect(sql).toMatch(/amount"[^\n]*> 0/);
    expect(sql).toContain('enforce_balanced_ledger_transaction');
    expect(sql).toContain('prevent_posted_ledger_mutation');
    expect(sql).toContain('ARENA_POINT');
  });
  it('models one wallet per user, bigint amounts, reversal, and no escrow', () => {
    expect(schema).toMatch(/model Wallet \{[\s\S]*userId\s+String\s+@unique/);
    expect(schema).toMatch(/model LedgerEntry \{[\s\S]*amount\s+BigInt/);
    expect(schema).toContain('reversesTransactionId');
    expect(schema).not.toMatch(/model\s+Escrow/);
  });
});
