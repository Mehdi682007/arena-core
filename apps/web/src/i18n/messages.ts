import type { AppLocale } from './config';

export interface AppMessages {
  readonly common: {
    readonly save: string;
    readonly saving: string;
    readonly cancel: string;
    readonly success: string;
    readonly requestId: string;
  };
  readonly shell: {
    readonly accountNavigation: string;
    readonly mainNavigation: string;
    readonly mobileNavigation: string;
    readonly login: string;
    readonly register: string;
    readonly footer: string;
    readonly unreadNotifications: (count: number) => string;
    readonly navigation: {
      readonly dashboard: string;
      readonly matchmaking: string;
      readonly matches: string;
      readonly profile: string;
      readonly notifications: string;
      readonly leaderboards: string;
      readonly settings: string;
    };
  };
  readonly auth: {
    readonly loginTitle: string;
    readonly registerTitle: string;
    readonly forgotTitle: string;
    readonly resetTitle: string;
    readonly verifyTitle: string;
    readonly email: string;
    readonly displayName: string;
    readonly password: string;
    readonly newPassword: string;
    readonly confirmPassword: string;
    readonly showPassword: string;
    readonly loginButton: string;
    readonly registerButton: string;
    readonly forgotButton: string;
    readonly resetButton: string;
    readonly verifyButton: string;
    readonly submitting: string;
    readonly forgotLink: string;
    readonly haveAccount: string;
    readonly registerHint: string;
    readonly privacyHint: string;
    readonly resetLinkMissing: string;
    readonly verificationLinkMissing: string;
    readonly passwordsMismatch: string;
    readonly forgotSuccess: string;
    readonly registerSuccess: string;
    readonly genericSuccess: string;
  };
  readonly settings: {
    readonly title: string;
    readonly accountTitle: string;
    readonly accountDescription: string;
    readonly profileTitle: string;
    readonly profileDescription: string;
    readonly securityTitle: string;
    readonly securityDescription: string;
    readonly sessionsTitle: string;
    readonly sessionsDescription: string;
    readonly notificationsTitle: string;
    readonly languageAndSecurity: string;
    readonly currentLanguage: string;
    readonly sessionCookieNotice: string;
    readonly profile: {
      readonly displayName: string;
      readonly locale: string;
      readonly timezone: string;
      readonly countryCode: string;
      readonly countryPlaceholder: string;
      readonly saved: string;
    };
    readonly password: {
      readonly title: string;
      readonly current: string;
      readonly next: string;
      readonly confirm: string;
      readonly submit: string;
      readonly notice: string;
      readonly mismatch: string;
    };
    readonly sessions: {
      readonly current: string;
      readonly active: string;
      readonly revoked: string;
      readonly expired: string;
      readonly lastSeen: string;
      readonly created: string;
      readonly expires: string;
      readonly device: string;
      readonly unknownDevice: string;
      readonly revoke: string;
      readonly revokeAll: string;
      readonly empty: string;
    };
  };
}

const fa: AppMessages = {
  common: {
    save: 'ذخیره',
    saving: 'در حال ذخیره…',
    cancel: 'انصراف',
    success: 'عملیات با موفقیت انجام شد.',
    requestId: 'شناسه پیگیری',
  },
  shell: {
    accountNavigation: 'حساب کاربری',
    mainNavigation: 'ناوبری اصلی',
    mobileNavigation: 'ناوبری موبایل',
    login: 'ورود',
    register: 'ثبت‌نام',
    footer: 'بستر رقابت شفاف و غیرمالی — نسخه پایه',
    unreadNotifications: (count) => `${String(count)} اعلان خوانده‌نشده`,
    navigation: {
      dashboard: 'داشبورد',
      matchmaking: 'رقابت',
      matches: 'مسابقه‌ها',
      profile: 'پروفایل',
      notifications: 'اعلان‌ها',
      leaderboards: 'رتبه‌بندی',
      settings: 'تنظیمات',
    },
  },
  auth: {
    loginTitle: 'ورود',
    registerTitle: 'ثبت‌نام',
    forgotTitle: 'بازیابی گذرواژه',
    resetTitle: 'تغییر گذرواژه',
    verifyTitle: 'تأیید ایمیل',
    email: 'ایمیل',
    displayName: 'نام نمایشی',
    password: 'گذرواژه',
    newPassword: 'گذرواژه جدید',
    confirmPassword: 'تکرار گذرواژه',
    showPassword: 'نمایش گذرواژه',
    loginButton: 'ورود',
    registerButton: 'ساخت حساب',
    forgotButton: 'ارسال راهنما',
    resetButton: 'تغییر گذرواژه',
    verifyButton: 'تأیید ایمیل',
    submitting: 'در حال ارسال…',
    forgotLink: 'گذرواژه را فراموش کرده‌اید؟',
    haveAccount: 'حساب دارید؟ وارد شوید.',
    registerHint:
      'گذرواژه باید الزامات واقعی سرویس را رعایت کند؛ اعتبارسنجی نهایی با سرور است.',
    privacyHint: 'برای حفظ حریم خصوصی، پاسخ وجود یا نبود حساب را مشخص نمی‌کند.',
    resetLinkMissing: 'پیوند بازیابی کامل نیست.',
    verificationLinkMissing: 'پیوند تأیید کامل نیست.',
    passwordsMismatch: 'گذرواژه‌ها یکسان نیستند.',
    forgotSuccess: 'اگر حسابی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.',
    registerSuccess: 'ثبت‌نام انجام شد. ایمیل خود را برای تأیید حساب بررسی کنید.',
    genericSuccess: 'عملیات با موفقیت انجام شد.',
  },
  settings: {
    title: 'تنظیمات',
    accountTitle: 'حساب و امنیت',
    accountDescription: 'پروفایل، گذرواژه، نشست‌های فعال و تنظیمات امنیتی حساب را مدیریت کنید.',
    profileTitle: 'پروفایل',
    profileDescription: 'نام نمایشی، زبان، منطقه زمانی و کشور را مدیریت کنید.',
    securityTitle: 'امنیت',
    securityDescription: 'گذرواژه و کنترل‌های امنیتی حساب را مدیریت کنید.',
    sessionsTitle: 'نشست‌ها',
    sessionsDescription:
      'دستگاه‌های واردشده به حساب را ببینید و دسترسی‌های قدیمی را ببندید.',
    notificationsTitle: 'ترجیحات اعلان',
    languageAndSecurity: 'زبان و امنیت',
    currentLanguage: 'زبان فعلی',
    sessionCookieNotice:
      'نشست شما با کوکی HttpOnly مدیریت می‌شود؛ هیچ توکن ورود در مرورگر ذخیره نمی‌شود.',
    profile: {
      displayName: 'نام نمایشی',
      locale: 'زبان',
      timezone: 'منطقه زمانی',
      countryCode: 'کشور',
      countryPlaceholder: 'مانند IR یا DE',
      saved: 'پروفایل ذخیره شد.',
    },
    password: {
      title: 'تغییر گذرواژه',
      current: 'گذرواژه فعلی',
      next: 'گذرواژه جدید',
      confirm: 'تکرار گذرواژه جدید',
      submit: 'تغییر گذرواژه',
      notice: 'پس از تغییر گذرواژه، نشست‌های فعلی بسته می‌شوند و باید دوباره وارد شوید.',
      mismatch: 'گذرواژه جدید و تکرار آن یکسان نیستند.',
    },
    sessions: {
      current: 'نشست فعلی',
      active: 'فعال',
      revoked: 'بسته‌شده',
      expired: 'منقضی',
      lastSeen: 'آخرین فعالیت',
      created: 'ایجاد',
      expires: 'انقضا',
      device: 'دستگاه',
      unknownDevice: 'دستگاه ناشناخته',
      revoke: 'بستن نشست',
      revokeAll: 'خروج از همه دستگاه‌ها',
      empty: 'نشستی برای نمایش وجود ندارد.',
    },
  },
};

const en: AppMessages = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    success: 'Completed successfully.',
    requestId: 'Request ID',
  },
  shell: {
    accountNavigation: 'Account',
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    login: 'Sign in',
    register: 'Create account',
    footer: 'Transparent, non-financial competitive play — foundation release',
    unreadNotifications: (count) => `${String(count)} unread notifications`,
    navigation: {
      dashboard: 'Dashboard',
      matchmaking: 'Compete',
      matches: 'Matches',
      profile: 'Profile',
      notifications: 'Notifications',
      leaderboards: 'Leaderboards',
      settings: 'Settings',
    },
  },
  auth: {
    loginTitle: 'Sign in',
    registerTitle: 'Create account',
    forgotTitle: 'Reset password',
    resetTitle: 'Choose a new password',
    verifyTitle: 'Verify email',
    email: 'Email',
    displayName: 'Display name',
    password: 'Password',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    showPassword: 'Show password',
    loginButton: 'Sign in',
    registerButton: 'Create account',
    forgotButton: 'Send reset instructions',
    resetButton: 'Change password',
    verifyButton: 'Verify email',
    submitting: 'Submitting…',
    forgotLink: 'Forgot your password?',
    haveAccount: 'Already have an account? Sign in.',
    registerHint:
      'Your password must meet the service security requirements. Final validation happens on the server.',
    privacyHint: 'For privacy, the response does not reveal whether an account exists.',
    resetLinkMissing: 'The password reset link is incomplete.',
    verificationLinkMissing: 'The verification link is incomplete.',
    passwordsMismatch: 'The passwords do not match.',
    forgotSuccess: 'If an account exists for this email, reset instructions will be sent.',
    registerSuccess: 'Your account was created. Check your email to verify it.',
    genericSuccess: 'Completed successfully.',
  },
  settings: {
    title: 'Settings',
    accountTitle: 'Account & security',
    accountDescription: 'Manage your profile, password, active sessions, and account security.',
    profileTitle: 'Profile',
    profileDescription: 'Manage your display name, language, time zone, and country.',
    securityTitle: 'Security',
    securityDescription: 'Manage your password and account security controls.',
    sessionsTitle: 'Sessions',
    sessionsDescription: 'Review signed-in devices and revoke access you no longer use.',
    notificationsTitle: 'Notification preferences',
    languageAndSecurity: 'Language & security',
    currentLanguage: 'Current language',
    sessionCookieNotice:
      'Your session is stored in an HttpOnly cookie. No sign-in token is stored in browser JavaScript storage.',
    profile: {
      displayName: 'Display name',
      locale: 'Language',
      timezone: 'Time zone',
      countryCode: 'Country',
      countryPlaceholder: 'For example IR or DE',
      saved: 'Profile saved.',
    },
    password: {
      title: 'Change password',
      current: 'Current password',
      next: 'New password',
      confirm: 'Confirm new password',
      submit: 'Change password',
      notice:
        'Changing your password signs out active sessions. You will need to sign in again.',
      mismatch: 'The new password and confirmation do not match.',
    },
    sessions: {
      current: 'Current session',
      active: 'Active',
      revoked: 'Revoked',
      expired: 'Expired',
      lastSeen: 'Last activity',
      created: 'Created',
      expires: 'Expires',
      device: 'Device',
      unknownDevice: 'Unknown device',
      revoke: 'Revoke session',
      revokeAll: 'Sign out all devices',
      empty: 'There are no sessions to display.',
    },
  },
};

export const appMessages: Readonly<Record<AppLocale, AppMessages>> = Object.freeze({ fa, en });

export function messagesFor(locale: AppLocale): AppMessages {
  return appMessages[locale];
}
