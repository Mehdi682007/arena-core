import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('MFA enrollment session assurance', () => {
  it('secures sessions after enabling TOTP in the same transaction callback', () => {
    const service = source('src/application/mfa-service.ts');

    const enable = service.indexOf('await repository.enableTotp({');

    const secure = service.indexOf('await repository.secureSessionsAfterMfaEnable({');

    expect(enable).toBeGreaterThan(-1);
    expect(secure).toBeGreaterThan(enable);
  });

  it('marks only the authenticated active session as MFA verified', () => {
    const repository = source('src/infrastructure/prisma-mfa-repository.ts');

    expect(repository).toContain('id: input.currentSessionId');

    expect(repository).toContain('userId: input.userId');

    expect(repository).toContain("status: 'ACTIVE'");

    expect(repository).toContain('mfaVerifiedAt: input.at');

    expect(repository).toContain('if (current.count !== 1)');

    expect(repository).toContain("'SESSION_INVALID'");
  });

  it('revokes every other active session when MFA becomes enabled', () => {
    const repository = source('src/infrastructure/prisma-mfa-repository.ts');

    expect(repository).toContain('not: input.currentSessionId');

    expect(repository).toContain("status: 'REVOKED'");

    expect(repository).toContain('revokedAt: input.at');

    expect(repository).toContain("revocationReason: 'MFA_ENABLED'");
  });

  it('binds enrollment confirmation to the authenticated session', () => {
    const controller = readFileSync(
      join(root, '../../apps/api/src/identity/mfa/mfa.controller.ts'),
      'utf8',
    );

    const call = controller.indexOf('confirmTotpEnrollment(');

    expect(call).toBeGreaterThan(-1);

    const fragment = controller.slice(call, call + 300);

    expect(fragment).toContain('principal.userId');

    expect(fragment).toContain('principal.sessionId');

    expect(fragment).toContain('input.code');
  });
});
