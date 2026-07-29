import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve('src/infrastructure/prisma-match-result-repository.ts'),
  'utf8',
);

describe('Prisma match result adapter contract', () => {
  it('uses explicit projections and ownership filters', () => {
    expect(source).toContain('const submissionSelect');
    expect(source).toContain('const resultSelect');
    expect(source).toMatch(/participants: \{ some: \{ userId \} \}/);
    expect(source).not.toMatch(/password|normalizedEmail|normalizedHandle|verificationMetadata/);
  });
  it('uses transactions, optimistic versions and one final result', () => {
    expect(source).toContain("if ('$transaction' in client)");
    expect(source).toContain('version: current.match.version');
    expect(source).toContain('matchResult.create');
    expect(source).toContain('matchResult.update');
  });
  it('preserves history and has bounded expiration', () => {
    expect(source).toContain("status: 'SUPERSEDED'");
    expect(source).toContain("status: 'WITHDRAWN'");
    expect(source).toContain('take: limit');
    expect(source).not.toMatch(/\$queryRaw|\$executeRaw/);
  });
  it('redacts persistence failures', () => {
    expect(source).toContain('MATCH_RESULT_PERSISTENCE_FAILURE');
    expect(source).not.toMatch(/String\(error\)|error\.message/);
  });
});
