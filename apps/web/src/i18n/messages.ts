import type { AppLocale } from './config';

export interface AppMessages {
  readonly publicShell: {
    readonly accountNavigation: string;
    readonly login: string;
    readonly register: string;
    readonly footer: string;
  };

  readonly appShell: {
    readonly mainNavigation: string;
    readonly mobileNavigation: string;
    readonly dashboard: string;
    readonly matchmaking: string;
    readonly matches: string;
    readonly profile: string;
    readonly notifications: string;
    readonly leaderboards: string;
    readonly settings: string;
    readonly unreadNotifications: (count: number) => string;
  };

  readonly auth: {
    readonly loginTitle: string;
    readonly registerTitle: string;
    readonly registerDescription: string;
    readonly forgotPasswordLink: string;
    readonly alreadyHaveAccount: string;
    readonly email: string;
    readonly displayName: string;
    readonly password: string;
    readonly newPassword: string;
    readonly passwordConfirmation: string;
    readonly showPassword: string;
    readonly passwordMismatch: string;
    readonly submitLogin: string;
    readonly submitRegister: string;
    readonly submitForgot: string;
    readonly submitReset: string;
    readonly submitVerify: string;
    readonly submitting: string;
    readonly forgotSuccess: string;
    readonly registerSuccess: string;
    readonly genericSuccess: string;
    readonly requestId: string;
  };

  readonly dashboard: {
    readonly hello: (name: string) => string;
    readonly emailNotVerified: string;
    readonly verifyEmail: string;
    readonly onboardingIncomplete: string;
    readonly ratingTitle: string;
    readonly noRating: string;
    readonly notificationsTitle: string;
    readonly noNotifications: string;
    readonly quickActions: string;
    readonly completeProfile: string;
  };

  readonly settings: {
    readonly title: string;
    readonly description: string;
    readonly account: string;
    readonly profile: string;
    readonly security: string;
    readonly languageAndSecurity: string;
    readonly currentLanguage: string;
    readonly sessionNotice: string;
    readonly notifications: string;
  };

  readonly profile: {
    readonly title: string;
    readonly onboardingStatus: string;
    readonly completed: string;
    readonly incomplete: string;
    readonly remainingSteps: string;
    readonly basicInformation: string;
    readonly displayName: string;
    readonly language: string;
    readonly timezone: string;
    readonly countryCode: string;
    readonly save: string;
    readonly saving: string;
    readonly saved: string;
    readonly saveFailed: string;
    readonly missingSteps: Readonly<Record<string, string>>;
  };

  readonly security: {
    readonly title: string;
    readonly description: string;
    readonly passwordTitle: string;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly confirmation: string;
    readonly showPassword: string;
    readonly mismatch: string;
    readonly changePassword: string;
    readonly changingPassword: string;
    readonly passwordChanged: string;
    readonly changeFailed: string;
    readonly logout: string;
    readonly loggingOut: string;
  };

  readonly notificationPreferences: {
    readonly saved: string;
    readonly failed: string;
    readonly inApp: string;
    readonly email: string;
    readonly save: string;
  };
}

const fa: AppMessages = {
  publicShell: {
    accountNavigation: 'حساب کاربری',
    login: 'ورود',
    register: 'ثبت‌نام',
    footer: 'بستر رقابت شفاف و غیرمالی — نسخه پایه',
  },

  appShell: {
    mainNavigation: 'ناوبری اصلی',
    mobileNavigation: 'ناوبری موبایل',
    dashboard: 'داشبورد',
    matchmaking: 'رقابت',
    matches: 'مسابقه‌ها',
    profile: 'پروفایل',
    notifications: 'اعلان‌ها',
    leaderboards: 'رتبه‌بندی',
    settings: 'تنظیمات',
    unreadNotifications: (count) => `${String(count)} اعلان خوانده‌نشده`,
  },

  auth: {
    loginTitle: 'ورود',
    registerTitle: 'ثبت‌نام',
    registerDescription:
      'گذرواژه باید الزامات واقعی سرویس را رعایت کند؛ اعتبارسنجی نهایی با سرور است.',
    forgotPasswordLink: 'گذرواژه را فراموش کرده‌اید؟',
    alreadyHaveAccount: 'حساب دارید؟ وارد شوید.',
    email: 'ایمیل',
    displayName: 'نام نمایشی',
    password: 'گذرواژه',
    newPassword: 'گذرواژه جدید',
    passwordConfirmation: 'تکرار گذرواژه',
    showPassword: 'نمایش گذرواژه',
    passwordMismatch: 'گذرواژه‌ها یکسان نیستند.',
    submitLogin: 'ورود',
    submitRegister: 'ساخت حساب',
    submitForgot: 'ارسال راهنما',
    submitReset: 'تغییر گذرواژه',
    submitVerify: 'تأیید ایمیل',
    submitting: 'در حال ارسال…',
    forgotSuccess: 'اگر حسابی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.',
    registerSuccess: 'ثبت‌نام انجام شد. ایمیل خود را برای تأیید حساب بررسی کنید.',
    genericSuccess: 'عملیات با موفقیت انجام شد.',
    requestId: 'شناسه پیگیری',
  },

  dashboard: {
    hello: (name) => `سلام، ${name}`,
    emailNotVerified: 'ایمیل شما هنوز تأیید نشده است.',
    verifyEmail: 'تأیید ایمیل',
    onboardingIncomplete: 'پروفایل خود را برای تکمیل شروع کار به‌روز کنید.',
    ratingTitle: 'رتبه شما',
    noRating: 'هنوز رتبه‌ای ثبت نشده است.',
    notificationsTitle: 'اعلان‌های تازه',
    noNotifications: 'اعلان تازه‌ای ندارید.',
    quickActions: 'اقدام‌های سریع',
    completeProfile: 'تکمیل پروفایل',
  },

  settings: {
    title: 'تنظیمات',
    description: 'حساب، امنیت، زبان و اعلان‌های خود را مدیریت کنید.',
    account: 'حساب کاربری',
    profile: 'پروفایل',
    security: 'امنیت',
    languageAndSecurity: 'زبان و نشست',
    currentLanguage: 'زبان فعلی',
    sessionNotice: 'نشست ورود با کوکی HttpOnly مدیریت می‌شود و توکن ورود در مرورگر ذخیره نمی‌شود.',
    notifications: 'ترجیحات اعلان',
  },

  profile: {
    title: 'پروفایل',
    onboardingStatus: 'وضعیت شروع کار',
    completed: 'تکمیل‌شده',
    incomplete: 'نیازمند تکمیل',
    remainingSteps: 'مراحل باقی‌مانده',
    basicInformation: 'اطلاعات پایه',
    displayName: 'نام نمایشی',
    language: 'زبان',
    timezone: 'منطقه زمانی',
    countryCode: 'کد کشور',
    save: 'ذخیره پروفایل',
    saving: 'در حال ذخیره…',
    saved: 'پروفایل ذخیره شد.',
    saveFailed: 'ذخیره پروفایل ممکن نشد.',
    missingSteps: {
      VERIFY_EMAIL: 'تأیید ایمیل',
      COMPLETE_PROFILE: 'تکمیل پروفایل',
      SET_TIMEZONE: 'تنظیم منطقه زمانی',
    },
  },

  security: {
    title: 'امنیت حساب',
    description: 'گذرواژه و نشست‌های ورود خود را مدیریت کنید.',
    passwordTitle: 'تغییر گذرواژه',
    currentPassword: 'گذرواژه فعلی',
    newPassword: 'گذرواژه جدید',
    confirmation: 'تکرار گذرواژه جدید',
    showPassword: 'نمایش گذرواژه‌ها',
    mismatch: 'گذرواژه جدید و تکرار آن یکسان نیستند.',
    changePassword: 'تغییر گذرواژه',
    changingPassword: 'در حال تغییر…',
    passwordChanged: 'گذرواژه تغییر کرد. برای امنیت، باید دوباره وارد حساب شوید.',
    changeFailed: 'تغییر گذرواژه ممکن نشد.',
    logout: 'خروج از حساب',
    loggingOut: 'در حال خروج…',
  },

  notificationPreferences: {
    saved: 'ترجیحات ذخیره شد.',
    failed: 'ذخیره ترجیحات ممکن نشد.',
    inApp: 'درون‌برنامه‌ای',
    email: 'ایمیل',
    save: 'ذخیره',
  },
};

const en: AppMessages = {
  publicShell: {
    accountNavigation: 'Account',
    login: 'Sign in',
    register: 'Create account',
    footer: 'Transparent, non-monetary online competition platform — foundation release',
  },

  appShell: {
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    dashboard: 'Dashboard',
    matchmaking: 'Competition',
    matches: 'Matches',
    profile: 'Profile',
    notifications: 'Notifications',
    leaderboards: 'Leaderboards',
    settings: 'Settings',
    unreadNotifications: (count) => `${String(count)} unread notifications`,
  },

  auth: {
    loginTitle: 'Sign in',
    registerTitle: 'Create your account',
    registerDescription:
      'Your password must satisfy the service security requirements. Final validation is performed by the server.',
    forgotPasswordLink: 'Forgot your password?',
    alreadyHaveAccount: 'Already have an account? Sign in.',
    email: 'Email',
    displayName: 'Display name',
    password: 'Password',
    newPassword: 'New password',
    passwordConfirmation: 'Confirm password',
    showPassword: 'Show password',
    passwordMismatch: 'The passwords do not match.',
    submitLogin: 'Sign in',
    submitRegister: 'Create account',
    submitForgot: 'Send recovery instructions',
    submitReset: 'Change password',
    submitVerify: 'Verify email',
    submitting: 'Submitting…',
    forgotSuccess:
      'If an account exists for this email address, recovery instructions will be sent.',
    registerSuccess: 'Your account was created. Check your email to verify the account.',
    genericSuccess: 'The operation completed successfully.',
    requestId: 'Request ID',
  },

  dashboard: {
    hello: (name) => `Hello, ${name}`,
    emailNotVerified: 'Your email address has not been verified yet.',
    verifyEmail: 'Verify email',
    onboardingIncomplete: 'Complete your profile to finish account setup.',
    ratingTitle: 'Your rating',
    noRating: 'You do not have a rating yet.',
    notificationsTitle: 'Recent notifications',
    noNotifications: 'You have no new notifications.',
    quickActions: 'Quick actions',
    completeProfile: 'Complete profile',
  },

  settings: {
    title: 'Settings',
    description: 'Manage your account, security, language and notifications.',
    account: 'Account',
    profile: 'Profile',
    security: 'Security',
    languageAndSecurity: 'Language and session',
    currentLanguage: 'Current language',
    sessionNotice:
      'Your sign-in session is managed with an HttpOnly cookie. Login tokens are not stored in browser storage.',
    notifications: 'Notification preferences',
  },

  profile: {
    title: 'Profile',
    onboardingStatus: 'Account setup',
    completed: 'Completed',
    incomplete: 'Needs attention',
    remainingSteps: 'Remaining steps',
    basicInformation: 'Basic information',
    displayName: 'Display name',
    language: 'Language',
    timezone: 'Time zone',
    countryCode: 'Country code',
    save: 'Save profile',
    saving: 'Saving…',
    saved: 'Profile saved.',
    saveFailed: 'Could not save the profile.',
    missingSteps: {
      VERIFY_EMAIL: 'Verify email',
      COMPLETE_PROFILE: 'Complete profile',
      SET_TIMEZONE: 'Set time zone',
    },
  },

  security: {
    title: 'Account security',
    description: 'Manage your password and active sign-in sessions.',
    passwordTitle: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmation: 'Confirm new password',
    showPassword: 'Show passwords',
    mismatch: 'The new passwords do not match.',
    changePassword: 'Change password',
    changingPassword: 'Changing…',
    passwordChanged: 'Your password was changed. For security, sign in again.',
    changeFailed: 'Could not change your password.',
    logout: 'Sign out',
    loggingOut: 'Signing out…',
  },

  notificationPreferences: {
    saved: 'Preferences saved.',
    failed: 'Could not save preferences.',
    inApp: 'In-app',
    email: 'Email',
    save: 'Save',
  },
};

const catalog: Readonly<Record<AppLocale, AppMessages>> = Object.freeze({
  fa,
  en,
});

export function messagesFor(locale: AppLocale): AppMessages {
  return catalog[locale];
}
