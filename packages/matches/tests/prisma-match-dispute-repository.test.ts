import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve('src/infrastructure/prisma-match-dispute-repository.ts'),
  'utf8',
);

describe('F4.4 Prisma dispute adapter', () => {
  it('uses explicit selects and composite participant ownership', () => {
    expect(source).toContain('const evidenceSelect');
    expect(source).toContain('const disputeSelect');
    expect(source).toContain('participantId: participant.id');
    expect(source).toContain('submittedByUserId: input.userId');
    expect(source).not.toMatch(/include:\s*\{\s*(?:user|openedBy|submittedBy)/);
  });
  it('makes opening, responding and resolution transactional and audited', () => {
    expect(source.match(/transact\(this\.client/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("action: 'DISPUTE_OPENED'");
    expect(source).toContain("action: 'DISPUTE_RESPONDED'");
    expect(source).toContain("action: 'DISPUTE_RESOLVED'");
    expect(source).toContain('matchResultRevision.create');
  });
  it('bounds expiration and does not implement automatic adjudication', () => {
    expect(source).toContain('take: limit');
    expect(source).toContain("status: 'UNDER_REVIEW'");
    expect(source).not.toMatch(/autoWin|automaticWinner|wallet|queue|redis/i);
    expect(source).toContain('resultContext.ratingApplicationExists');
  });
  it('does not select identity credentials or persist storage fields', () => {
    expect(source).not.toMatch(
      /passwordHash|normalizedEmail|sessionToken|storageKey|externalUrl|mimeType/,
    );
  });
});
