import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

describe('MFA login UI', () => {
  it('stops email login on an MFA challenge before redirect', () => {
    const source = readFileSync(path.join(root, 'src/features/auth/auth-form.tsx'), 'utf8');

    expect(source).toContain('browserApi<LoginResponse>');

    expect(source).toContain('result.mfaRequired === true');

    expect(source).toContain('setMfaChallengeToken');

    expect(source).toContain('<MfaLoginChallenge');

    expect(source).toContain('onComplete={completeLogin}');
  });

  it('confirms TOTP or recovery code without persisting the challenge token', () => {
    const source = readFileSync(
      path.join(root, 'src/features/auth/mfa-login-challenge.tsx'),
      'utf8',
    );

    expect(source).toContain("'/auth/mfa/challenge/confirm'");

    expect(source).toContain('challengeToken');

    expect(source).toContain('autoComplete="one-time-code"');

    expect(source).toContain('.toUpperCase()');

    expect(source).not.toContain('localStorage');

    expect(source).not.toContain('sessionStorage');
  });

  it('supports phone OTP MFA challenge', () => {
    const source = readFileSync(path.join(root, 'src/features/auth/phone-login-form.tsx'), 'utf8');

    const mfaGate = source.indexOf('loginResult.mfaRequired === true');

    const completion = source.indexOf('await completePhoneLogin();', mfaGate);

    expect(source).toContain('browserApi<PhoneLoginConfirmResponse>');

    expect(source).toContain('loginResult.challengeToken');

    expect(source).toContain('<MfaLoginChallenge');

    expect(source).toContain('onComplete={completePhoneLogin}');

    expect(mfaGate).toBeGreaterThan(-1);
    expect(completion).toBeGreaterThan(mfaGate);

    expect(source).not.toContain('localStorage.setItem');

    expect(source).not.toContain('sessionStorage.setItem');
  });
});
