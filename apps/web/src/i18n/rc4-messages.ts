import type { AppLocale } from './config';

const fa = {
  loginMethods: {
    email: 'ایمیل و گذرواژه',
    phone: 'موبایل و کد یک‌بارمصرف',
    ariaLabel: 'روش ورود',
  },

  phoneLogin: {
    phone: 'شماره موبایل',
    phoneHint: 'شماره را با کد کشور وارد کنید، مانند +989121234567.',
    requestCode: 'ارسال کد ورود',
    requesting: 'در حال ارسال…',
    code: 'کد ۶ رقمی',
    confirm: 'ورود با کد',
    confirming: 'در حال بررسی…',
    accepted: 'اگر این شماره برای ورود فعال باشد، کد یک‌بارمصرف ارسال می‌شود.',
    changePhone: 'تغییر شماره',
    genericError: 'انجام عملیات ورود با موبایل ممکن نشد.',
  },

  phoneManager: {
    phones: 'شماره‌های تأییدشده',
    empty: 'هنوز شماره موبایلی به حساب متصل نشده است.',
    primary: 'اصلی',
    verified: 'تأییدشده',
    add: 'افزودن شماره موبایل',
    phone: 'شماره موبایل',
    hint: 'شماره را همراه کد کشور وارد کنید، مانند +989121234567.',
    request: 'ارسال کد تأیید',
    requesting: 'در حال ارسال…',
    accepted: 'درخواست ثبت شد. اگر شماره قابل استفاده باشد، کد تأیید ارسال می‌شود.',
    code: 'کد ۶ رقمی',
    confirm: 'تأیید شماره',
    confirming: 'در حال تأیید…',
    cancel: 'تغییر شماره',
    verifiedSuccess: 'شماره موبایل با موفقیت تأیید شد.',
    failed: 'عملیات شماره موبایل انجام نشد.',
  },

  sessionManager: {
    current: 'نشست فعلی',
    unknownDevice: 'دستگاه ناشناس',
    created: 'ایجاد',
    lastActive: 'آخرین فعالیت',
    expires: 'انقضا',
    revoke: 'خروج از این نشست',
    revoking: 'در حال خروج…',
    revokeOthers: 'خروج از همه نشست‌های دیگر',
    revokingOthers: 'در حال بستن نشست‌ها…',
    empty: 'نشست فعال دیگری وجود ندارد.',
    failed: 'انجام عملیات روی نشست ممکن نشد.',
  },

  gameAccounts: {
    add: 'افزودن حساب بازی',
    game: 'بازی',
    platform: 'پلتفرم',
    handle: 'شناسه بازیکن',
    submit: 'ثبت حساب',
    submitting: 'در حال ثبت…',
    accounts: 'حساب‌های بازی',
    noPlatform: 'پلتفرم قابل ثبت دیگری وجود ندارد.',
    empty: 'هنوز حساب بازی ثبت نکرده‌اید.',
    primary: 'اصلی',
    makePrimary: 'انتخاب به‌عنوان حساب اصلی',
    disconnect: 'قطع اتصال',
    resubmit: 'ارسال دوباره برای بررسی',
    submitForReview: 'ارسال برای بررسی',
    delete: 'حذف حساب',
    restore: 'بازیابی حساب',
    details: 'جزئیات و ویرایش',
    working: 'در حال انجام…',
    failed: 'انجام عملیات ممکن نشد.',
    created: 'درخواست حساب بازی ثبت شد.',
    status: {
      DRAFT: 'پیش‌نویس',
      PENDING: 'در انتظار بررسی',
      VERIFIED: 'تأییدشده',
      REJECTED: 'ردشده',
      CHANGES_REQUESTED: 'نیازمند اصلاح',
      SUSPENDED: 'تعلیق‌شده',
      DISCONNECTED: 'قطع‌شده',
    },
  },

  settings: {
    sessions: 'نشست‌ها',
    phone: 'شماره موبایل',
    gameAccounts: 'حساب‌های بازی',
    currentLanguage: 'فارسی',
  },

  sessionsPage: {
    title: 'نشست‌های فعال',
    description: 'دستگاه‌هایی که در حال حاضر به حساب شما دسترسی دارند را بررسی و مدیریت کنید.',
  },

  phonePage: {
    title: 'شماره موبایل',
    description: 'شماره‌های موبایل تأییدشده‌ی حساب و امکان افزودن شماره جدید را مدیریت کنید.',
  },

  gameAccountsPage: {
    title: 'حساب‌های بازی',
    description: 'حساب‌ها و شناسه‌های بازی خود را برای پلتفرم‌های مختلف مدیریت کنید.',
  },

  mfa: {
    settingsSecurityMfaPage01: 'احراز هویت دومرحله‌ای',
    settingsSecurityMfaPage02: 'Authenticator و کدهای بازیابی حساب را مدیریت کنید.',
    featuresAuthMfaLoginChallenge01: {
      title: 'تأیید دومرحله‌ای',
      description: 'کد ۶ رقمی برنامه احراز هویت یا یکی از کدهای بازیابی خود را وارد کنید.',
      codeLabel: 'کد احراز هویت',
      codeHint: 'کد TOTP شش‌رقمی یا کد بازیابی را وارد کنید.',
      submit: 'تأیید و ورود',
      submitting: 'در حال تأیید...',
      cancel: 'بازگشت',
    },
    featuresSettingsMfaEnrollmentManager01: {
      enabled: 'فعال',
      disabled: 'غیرفعال',
      title: 'احراز هویت دومرحله‌ای',
      description: 'برای ورود امن‌تر، یک برنامه Authenticator را به حساب متصل کنید.',
      status: 'وضعیت',
      recoveryRemaining: 'کدهای بازیابی باقی‌مانده',
      enabledAt: 'فعال‌شده در',
      start: 'فعال‌سازی MFA',
      starting: 'در حال آماده‌سازی…',
      setupTitle: 'اتصال برنامه Authenticator',
      setupHint:
        'لینک زیر را با برنامه Authenticator باز کنید یا Secret را به‌صورت دستی وارد کنید.',
      qrLabel: 'کد QR راه‌اندازی Authenticator',
      instruction1: 'کد QR را با برنامه Authenticator اسکن کنید.',
      instruction2: 'اگر اسکن ممکن نیست، کلید دستی را وارد کنید.',
      instruction3: 'کد ۶ رقمی برنامه را برای تأیید وارد کنید.',
      copyKey: 'کپی کلید دستی',
      setupWarning:
        'کد QR و کلید راه‌اندازی را با کسی به اشتراک نگذارید. تا پیش از تأیید، Authenticator فعلی و کدهای بازیابی شما تغییر نمی‌کنند.',
      openAuthenticator: 'باز کردن در Authenticator',
      secret: 'Secret',
      code: 'کد ۶ رقمی Authenticator',
      confirm: 'تأیید و فعال‌سازی',
      confirming: 'در حال تأیید…',
      cancel: 'لغو و شروع دوباره',
      recoveryTitle: 'کدهای بازیابی',
      recoveryWarning:
        'این کدها فقط همین یک بار نمایش داده می‌شوند. آن‌ها را در محل امن ذخیره کنید. هر کد فقط یک بار قابل استفاده است.',
      recoveryDone: 'کدها را ذخیره کردم',
      recoveryEmergencyWarning:
        'این‌ها کد ورود اضطراری هستند، نه کلید راه‌اندازی Authenticator. کدهای قبلی پس از تعویض معتبر نیستند؛ این کدهای جدید را همین حالا در محل امن نگه دارید.',
      copyRecovery: 'کپی کدها',
      downloadRecovery: 'دانلود کدها',
      replace: 'تعویض برنامه Authenticator',
      replaceDescription:
        'برای تعویض، باید اخیراً با MFA تأیید شده باشید. ورود با کد بازیابی نیز این تأیید را فراهم می‌کند.',
      genericError: 'عملیات MFA انجام نشد.',
    },
    featuresSettingsMfaEnrollmentManager02: 'fa-IR',
  },
} as const;

const en = {
  loginMethods: {
    email: 'Email & password',
    phone: 'Mobile & OTP',
    ariaLabel: 'Sign-in method',
  },

  phoneLogin: {
    phone: 'Mobile number',
    phoneHint: 'Enter the number with its country code, for example +989121234567.',
    requestCode: 'Send sign-in code',
    requesting: 'Sending…',
    code: '6-digit code',
    confirm: 'Sign in with code',
    confirming: 'Verifying…',
    accepted: 'If this number is enabled for sign-in, a one-time code will be sent.',
    changePhone: 'Change number',
    genericError: 'Mobile sign-in could not be completed.',
  },

  phoneManager: {
    phones: 'Verified phone numbers',
    empty: 'No mobile number is connected to this account yet.',
    primary: 'Primary',
    verified: 'Verified',
    add: 'Add mobile number',
    phone: 'Mobile number',
    hint: 'Enter the number with its country code, for example +989121234567.',
    request: 'Send verification code',
    requesting: 'Sending…',
    accepted:
      'The request was accepted. If the number can be used, a verification code will be sent.',
    code: '6-digit code',
    confirm: 'Verify number',
    confirming: 'Verifying…',
    cancel: 'Change number',
    verifiedSuccess: 'The mobile number was verified successfully.',
    failed: 'The mobile number operation could not be completed.',
  },

  sessionManager: {
    current: 'Current session',
    unknownDevice: 'Unknown device',
    created: 'Created',
    lastActive: 'Last active',
    expires: 'Expires',
    revoke: 'Sign out this session',
    revoking: 'Signing out…',
    revokeOthers: 'Sign out all other sessions',
    revokingOthers: 'Signing out sessions…',
    empty: 'There are no other active sessions.',
    failed: 'Could not update the session.',
  },

  gameAccounts: {
    add: 'Add game account',
    game: 'Game',
    platform: 'Platform',
    handle: 'Player handle',
    submit: 'Submit account',
    submitting: 'Submitting…',
    accounts: 'Game accounts',
    noPlatform: 'There are no additional claimable platforms.',
    empty: 'You have not added a game account yet.',
    primary: 'Primary',
    makePrimary: 'Make primary',
    disconnect: 'Disconnect',
    resubmit: 'Resubmit for review',
    submitForReview: 'Submit for review',
    delete: 'Delete account',
    restore: 'Restore account',
    details: 'Details and edit',
    working: 'Working…',
    failed: 'The operation could not be completed.',
    created: 'Game account claim submitted.',
    status: {
      DRAFT: 'Draft',
      PENDING: 'Pending review',
      VERIFIED: 'Verified',
      REJECTED: 'Rejected',
      CHANGES_REQUESTED: 'Changes requested',
      SUSPENDED: 'Suspended',
      DISCONNECTED: 'Disconnected',
    },
  },

  settings: {
    sessions: 'Sessions',
    phone: 'Mobile numbers',
    gameAccounts: 'Game accounts',
    currentLanguage: 'English',
  },

  sessionsPage: {
    title: 'Active sessions',
    description: 'Review and manage devices that currently have access to your account.',
  },

  phonePage: {
    title: 'Mobile numbers',
    description: 'Manage verified mobile numbers and add a new number to your account.',
  },

  gameAccountsPage: {
    title: 'Game accounts',
    description: 'Manage your game identities across supported games and platforms.',
  },

  mfa: {
    settingsSecurityMfaPage01: 'Two-factor authentication',
    settingsSecurityMfaPage02: 'Manage your authenticator and account recovery codes.',
    featuresAuthMfaLoginChallenge01: {
      title: 'Two-factor authentication',
      description:
        'Enter the 6-digit code from your authenticator app or one of your recovery codes.',
      codeLabel: 'Authentication code',
      codeHint: 'Enter a six-digit TOTP code or a recovery code.',
      submit: 'Verify and sign in',
      submitting: 'Verifying...',
      cancel: 'Back',
    },
    featuresSettingsMfaEnrollmentManager01: {
      enabled: 'Enabled',
      disabled: 'Disabled',
      title: 'Two-factor authentication',
      description: 'Connect an authenticator app for stronger account security.',
      status: 'Status',
      recoveryRemaining: 'Recovery codes remaining',
      enabledAt: 'Enabled at',
      start: 'Enable MFA',
      starting: 'Preparing…',
      setupTitle: 'Connect an authenticator app',
      setupHint: 'Open the link below with an authenticator app or enter the secret manually.',
      qrLabel: 'Authenticator setup QR code',
      instruction1: 'Scan the QR code with your authenticator app.',
      instruction2: 'If scanning is unavailable, enter the manual key.',
      instruction3: 'Enter the app’s 6-digit code to confirm.',
      copyKey: 'Copy manual key',
      setupWarning:
        'Never share this QR code or setup key. Your current authenticator and recovery codes remain active until confirmation succeeds.',
      openAuthenticator: 'Open in authenticator',
      secret: 'Secret',
      code: '6-digit authenticator code',
      confirm: 'Verify and enable',
      confirming: 'Verifying…',
      cancel: 'Cancel and restart',
      recoveryTitle: 'Recovery codes',
      recoveryWarning:
        'These codes are shown only once. Store them somewhere safe. Each code can be used only once.',
      recoveryDone: 'I saved the codes',
      recoveryEmergencyWarning:
        'These are emergency login codes, not authenticator setup keys. Previous codes are invalid after rotation; store these new codes securely now.',
      copyRecovery: 'Copy codes',
      downloadRecovery: 'Download codes',
      replace: 'Replace authenticator app',
      replaceDescription:
        'Recent MFA verification is required. Signing in with a recovery code also provides this assurance.',
      genericError: 'The MFA operation could not be completed.',
    },
    featuresSettingsMfaEnrollmentManager02: 'en-US',
  },
} as const;

const catalog = {
  fa,
  en,
} as const satisfies Readonly<Record<AppLocale, typeof fa | typeof en>>;

export function rc4MessagesFor(locale: AppLocale) {
  return catalog[locale];
}
