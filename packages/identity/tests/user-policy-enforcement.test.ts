import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('identity user policy enforcement', () => {
  it('permits password-reset token issuance only for active users', () => {
    const source = readFileSync(
      new URL('../src/application/token-services.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("identity.status !== 'ACTIVE'");

    expect(source).not.toContain("['ACTIVE', 'SUSPENDED'].includes(identity.status)");
  });

  it('requires active non-deleted accounts for authentication and sessions', () => {
    const source = readFileSync(
      new URL('../src/application/identity-services.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("status !== 'ACTIVE' || deletedAt !== null");

    expect(source).toContain('session.securityVersion !== session.user.securityVersion');
  });

  it('allows profile access only for active or pending-verification accounts', () => {
    const source = readFileSync(
      new URL('../src/application/profile-service.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("['ACTIVE', 'PENDING_VERIFICATION'].includes(state.status)");

    expect(source).toContain('state.deletedAt !== null');
  });
});
