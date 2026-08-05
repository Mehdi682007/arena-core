import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('identity user policy enforcement', () => {
  it('permits password-reset token issuance only for active users', () => {
    const source = readSource('src/application/token-services.ts');

    expect(source).toContain("identity.status !== 'ACTIVE'");

    expect(source).not.toContain("['ACTIVE', 'SUSPENDED'].includes(identity.status)");
  });

  it('requires active non-deleted accounts for authentication and sessions', () => {
    const source = readSource('src/application/identity-services.ts');

    expect(source).toContain("status !== 'ACTIVE' || deletedAt !== null");

    expect(source).toContain('session.securityVersion !== session.user.securityVersion');
  });

  it('allows profile access only for active or pending-verification accounts', () => {
    const source = readSource('src/application/profile-service.ts');

    expect(source).toContain("['ACTIVE', 'PENDING_VERIFICATION'].includes(state.status)");

    expect(source).toContain('state.deletedAt !== null');
  });
});
