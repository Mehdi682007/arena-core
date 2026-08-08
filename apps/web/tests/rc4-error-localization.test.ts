import { describe, expect, it } from 'vitest';
import { messageForCode } from '../src/lib/errors/messages';

describe('RC4 API error localization', () => {
  it('returns Persian messages for Persian locale', () => {
    expect(messageForCode('VALIDATION_FAILED', 'fa')).toBe('اطلاعات واردشده را بررسی کنید.');
    expect(messageForCode('MFA_REQUIRED', 'fa')).toContain('احراز هویت دومرحله‌ای');
  });

  it('returns English messages for English locale', () => {
    expect(messageForCode('VALIDATION_FAILED', 'en')).toBe('Review the information you entered.');
    expect(messageForCode('MFA_REQUIRED', 'en')).toContain('two-factor authentication');
  });
});
