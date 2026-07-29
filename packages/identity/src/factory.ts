import type { AuthenticationConfig } from '@arena-core/config';
import { IdentityService, SessionService } from './application/identity-services';
import { EmailVerificationService, PasswordResetService } from './application/token-services';
import {
  NodeArgon2PasswordHasher,
  NodeCryptoTokenService,
  SystemClock,
} from './infrastructure/node-crypto';
import type { IdentityTransactionManager } from './ports/identity-repository';

export async function createIdentityServices(
  config: AuthenticationConfig,
  transactions: IdentityTransactionManager,
): Promise<{
  identity: IdentityService;
  sessions: SessionService;
  emailVerification: EmailVerificationService;
  passwordReset: PasswordResetService;
}> {
  const passwordHasher = new NodeArgon2PasswordHasher(config.password);
  const dependencies = {
    config,
    passwordHasher,
    tokenService: new NodeCryptoTokenService(config),
    clock: new SystemClock(),
    transactions,
    dummyPasswordHash: (await passwordHasher.hash('dummy-password-not-used-for-an-account'))
      .encodedHash,
  };
  return Object.freeze({
    identity: new IdentityService(dependencies),
    sessions: new SessionService(dependencies),
    emailVerification: new EmailVerificationService(dependencies),
    passwordReset: new PasswordResetService(dependencies),
  });
}
