import type { AppLocale } from './config';

type AdminNavigationItemText = {
  label: string;
  description: string;
};

type AdminNavigationGroupText = {
  label: string;
};

export type AdminItemKey =
  | 'overview'
  | 'search'
  | 'users'
  | 'diagnostics'
  | 'audit'
  | 'gameAccounts'
  | 'siteSettings'
  | 'matches'
  | 'results'
  | 'disputes'
  | 'matchmaking'
  | 'ratings'
  | 'wallets'
  | 'finance'
  | 'settlements'
  | 'notifications'
  | 'support';

export type AdminDictionary = {
  operationsCenter: string;
  adminNavigation: string;
  administration: string;
  production: string;
  quickSearch: string;
  securityControlled: string;
  backToApplication: string;
  openMenu: string;
  closeMenu: string;
  switchToPersian: string;
  switchToEnglish: string;

  users: {
    title: string;
    manualOperations: string;
    securityVersion: string;
    readOnly: string;
    email: string;
    verified: string;
    notVerified: string;
    verifyEmail: string;
    emailAlreadyVerified: string;
    suspend: string;
    restore: string;
    delete: string;
    active: string;
    suspended: string;
    banned: string;
    deleted: string;
    sessions: string;
    revokeSessions: string;
    roles: string;
    addRole: string;
    removeRole: string;
    previewSimulation: string;
    operationFailed: string;
    emailVerifiedSuccessfully: string;
    verifyEmailTitle: string;
    verifyEmailDescriptionBefore: string;
    verifyEmailDescriptionAfter: string;
    reasonCode: string;
    administratorNote: string;
    verifyEmailNotePlaceholder: string;
    deleteSuccessfully: string;
    restoreSuccessfully: string;
    deleteTitle: string;
    restoreTitle: string;
    deleteDescription: string;
    restoreDescription: string;
    deletionNotePlaceholder: string;
    softDelete: string;
  };

  actions: {
    confirm: string;
    cancel: string;
    submit: string;
    reason: string;
    note: string;
  };

  common: {
    loading: string;
    empty: string;
    search: string;
    authorizedApiNotice: string;
    noDisplayData: string;
    walletGuidance: string;
    financeGuidance: string;
    outbox: string;
    deadLetter: string;
    recovery: string;
    viewMessages: string;
    stoppedMessages: string;
    recoveryOperations: string;
  };

  groups: Record<string, AdminNavigationGroupText>;
  items: Record<AdminItemKey, AdminNavigationItemText>;
};

const fa: AdminDictionary = {
  operationsCenter: 'مرکز عملیات',
  adminNavigation: 'ناوبری مدیریت',
  administration: 'مدیریت',
  production: 'محیط تولید',
  quickSearch: 'جستجوی سریع',
  securityControlled: 'دسترسی‌ها توسط سرور کنترل می‌شوند',
  backToApplication: 'بازگشت به برنامه',
  openMenu: 'بازکردن منوی مدیریت',
  closeMenu: 'بستن منوی مدیریت',
  switchToPersian: 'تغییر زبان به فارسی',
  switchToEnglish: 'تغییر زبان به انگلیسی',
  users: {
    title: 'کاربران',
    manualOperations: 'عملیات دستی مدیر',
    securityVersion: 'نسخه امنیتی',
    readOnly: 'این حساب برای شما فقط خواندنی است.',
    email: 'ایمیل',
    verified: 'تأیید شده',
    notVerified: 'تأیید نشده',
    verifyEmail: 'تأیید ایمیل',
    emailAlreadyVerified: 'ایمیل قبلاً تأیید شده است',
    suspend: 'تغییر وضعیت حساب',
    restore: 'بازگردانی حساب',
    delete: 'حذف حساب',
    active: 'فعال',
    suspended: 'تعلیق موقت',
    banned: 'مسدود دائمی',
    deleted: 'حذف شده',
    sessions: 'نشست‌ها',
    revokeSessions: 'بستن همه نشست‌ها',
    roles: 'نقش‌ها',
    addRole: 'افزودن نقش',
    removeRole: 'حذف نقش',
    previewSimulation: 'این عملیات در حالت پیش‌نمایش شبیه‌سازی شد و داده‌ای تغییر نکرد.',
    operationFailed: 'عملیات انجام نشد. مجوز، وضعیت حساب و ارتباط با API را بررسی کنید.',
    emailVerifiedSuccessfully: 'ایمیل کاربر با موفقیت تأیید شد.',
    verifyEmailTitle: 'تأیید دستی ایمیل',
    verifyEmailDescriptionBefore: 'ایمیل',
    verifyEmailDescriptionAfter:
      'به‌صورت دستی تأیید می‌شود. این عملیات در رویدادهای ممیزی ثبت خواهد شد.',
    reasonCode: 'کد دلیل',
    administratorNote: 'توضیح مدیر',
    verifyEmailNotePlaceholder: 'دلیل تأیید دستی ایمیل را ثبت کنید.',
    deleteSuccessfully: 'حساب کاربر به‌صورت نرم حذف شد.',
    restoreSuccessfully: 'حساب کاربر با موفقیت بازگردانی شد.',
    deleteTitle: 'حذف حساب کاربر',
    restoreTitle: 'بازگردانی حساب کاربر',
    deleteDescription:
      'حساب حذف فیزیکی نمی‌شود، اما ورود کاربر مسدود و همه نشست‌های فعال بسته خواهند شد.',
    restoreDescription:
      'حساب با توجه به وضعیت تأیید ایمیل به حالت فعال یا در انتظار تأیید بازگردانده می‌شود.',
    deletionNotePlaceholder: 'دلیل و شواهد این عملیات را ثبت کنید.',
    softDelete: 'حذف نرم حساب',
  },
  actions: {
    confirm: 'تأیید',
    cancel: 'انصراف',
    submit: 'ثبت',
    reason: 'کد دلیل',
    note: 'توضیح مدیر',
  },
  common: {
    loading: 'در حال بارگذاری...',
    empty: 'موردی یافت نشد',
    search: 'جستجو',
    authorizedApiNotice:
      'نمایش فقط از API مدیریتی مجوزسنجی‌شده انجام می‌شود؛ داده حساس پیش از نمایش پالایش می‌شود.',
    noDisplayData: 'داده‌ای برای نمایش وجود ندارد',
    walletGuidance:
      'کاربر را از جستجوی پشتیبانی انتخاب کنید. تغییر موجودی مستقیم وجود ندارد؛ صدور، تعدیل، برگشت و تطبیق فقط با دلیل و کلید تکرارناپذیری مجاز است.',
    financeGuidance:
      'برای مشاهده رزرو و تطبیق، شناسه مسابقه را از صفحه مسابقه انتخاب کنید. تمام عملیات مالی از سرویس دامنه و با کلید تکرارناپذیری انجام می‌شود.',
    outbox: 'صندوق خروجی',
    deadLetter: 'پیام‌های متوقف‌شده',
    recovery: 'بازیابی',
    viewMessages: 'مشاهده پیام‌ها',
    stoppedMessages: 'پیام‌های متوقف‌شده',
    recoveryOperations: 'عملیات بازیابی',
  },
  groups: {
    operations: {
      label: 'مرکز عملیات',
    },
    competition: {
      label: 'رقابت و بازیکنان',
    },
    finance: {
      label: 'مالی',
    },
    communications: {
      label: 'ارتباطات و بازیابی',
    },
  },
  items: {
    overview: {
      label: 'نمای کلی',
      description: 'سلامت و دسترسی‌های مدیریتی',
    },
    search: {
      label: 'جستجوی پشتیبانی',
      description: 'کاربر، مسابقه و حساب بازی',
    },
    users: {
      label: 'مدیریت کاربران',
      description: 'وضعیت، نشست‌ها و نقش‌های کاربران',
    },
    diagnostics: {
      label: 'وضعیت سرویس',
      description: 'نسخه، وابستگی‌ها و محیط',
    },
    audit: {
      label: 'رویدادهای ممیزی',
      description: 'ردپای عملیات حساس',
    },
    gameAccounts: {
      label: 'حساب‌های بازی',
      description: 'بررسی و تأیید حساب‌ها',
    },
    siteSettings: {
      label: 'تنظیمات سایت',
      description: 'برند، صفحه اول و اعلان عمومی',
    },
    matches: {
      label: 'مسابقه‌ها',
      description: 'وضعیت و جریان مسابقات',
    },
    results: {
      label: 'تعارض نتیجه‌ها',
      description: 'نتایج نیازمند تصمیم',
    },
    disputes: {
      label: 'اختلاف‌ها',
      description: 'صف بررسی اختلافات',
    },
    matchmaking: {
      label: 'همتایابی',
      description: 'درخواست‌ها و پیشنهادها',
    },
    ratings: {
      label: 'رتبه‌بندی',
      description: 'اعمال و بازبینی امتیازها',
    },
    wallets: {
      label: 'کیف پول و دفترکل',
      description: 'موجودی و تراکنش‌ها',
    },
    finance: {
      label: 'مالی مسابقه',
      description: 'رزرو و بازپرداخت',
    },
    settlements: {
      label: 'تسویه‌ها',
      description: 'تسویه و تطبیق مالی',
    },
    notifications: {
      label: 'اعلان‌ها',
      description: 'Outbox و Dead-letter',
    },
    support: {
      label: 'عملیات پشتیبانی',
      description: 'بازیابی کنترل‌شده',
    },
  },
};

const en: AdminDictionary = {
  operationsCenter: 'Operations center',
  adminNavigation: 'Administration navigation',
  administration: 'Administration',
  production: 'Production',
  quickSearch: 'Quick search',
  securityControlled: 'Access is enforced by the server',
  backToApplication: 'Back to application',
  openMenu: 'Open administration menu',
  closeMenu: 'Close administration menu',
  switchToPersian: 'Switch language to Persian',
  switchToEnglish: 'Switch language to English',
  users: {
    title: 'Users',
    manualOperations: 'Manual administrator operations',
    securityVersion: 'Security version',
    readOnly: 'This account is read-only for your current permissions.',
    email: 'Email',
    verified: 'Verified',
    notVerified: 'Not verified',
    verifyEmail: 'Verify email',
    emailAlreadyVerified: 'Email is already verified',
    suspend: 'Change account status',
    restore: 'Restore account',
    delete: 'Delete account',
    active: 'Active',
    suspended: 'Temporary suspension',
    banned: 'Permanent ban',
    deleted: 'Deleted',
    sessions: 'Sessions',
    revokeSessions: 'Revoke all sessions',
    roles: 'Roles',
    addRole: 'Add role',
    removeRole: 'Remove role',
    previewSimulation: 'This operation was simulated in preview mode and no data was changed.',
    operationFailed:
      'The operation failed. Check your permissions, account state, and API connection.',
    emailVerifiedSuccessfully: 'The user email was verified successfully.',
    verifyEmailTitle: 'Manually verify email',
    verifyEmailDescriptionBefore: 'Email',
    verifyEmailDescriptionAfter:
      'will be verified manually. This operation will be recorded in the audit log.',
    reasonCode: 'Reason code',
    administratorNote: 'Administrator note',
    verifyEmailNotePlaceholder: 'Record the reason for manually verifying this email.',
    deleteSuccessfully: 'The user account was soft-deleted successfully.',
    restoreSuccessfully: 'The user account was restored successfully.',
    deleteTitle: 'Delete user account',
    restoreTitle: 'Restore user account',
    deleteDescription:
      'The account will not be physically removed, but sign-in will be blocked and all active sessions will be revoked.',
    restoreDescription:
      'The account will be restored to active or pending verification according to its email verification state.',
    deletionNotePlaceholder: 'Record the reason and evidence for this operation.',
    softDelete: 'Soft-delete account',
  },
  actions: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    submit: 'Submit',
    reason: 'Reason code',
    note: 'Administrator note',
  },
  common: {
    loading: 'Loading...',
    empty: 'No data found',
    search: 'Search',
    authorizedApiNotice:
      'Data is shown only through the permission-checked administration API and is sanitized before display.',
    noDisplayData: 'There is no data to display',
    walletGuidance:
      'Select a user through support search. Direct balance mutation is unavailable; issuance, adjustment, reversal, and reconciliation require a reason and idempotency key.',
    financeGuidance:
      'Select a match ID from the match page to inspect reservations and reconciliation. Every financial operation uses the domain service and an idempotency key.',
    outbox: 'Outbox',
    deadLetter: 'Dead-letter',
    recovery: 'Recovery',
    viewMessages: 'View messages',
    stoppedMessages: 'Stopped messages',
    recoveryOperations: 'Recovery operations',
  },
  groups: {
    operations: {
      label: 'Operations center',
    },
    competition: {
      label: 'Competition and players',
    },
    finance: {
      label: 'Finance',
    },
    communications: {
      label: 'Communications and recovery',
    },
  },
  items: {
    overview: {
      label: 'Overview',
      description: 'System health and administrative access',
    },
    search: {
      label: 'Support search',
      description: 'Users, matches and game accounts',
    },
    users: {
      label: 'User management',
      description: 'Status, sessions and roles',
    },
    diagnostics: {
      label: 'Service status',
      description: 'Version, dependencies and environment',
    },
    audit: {
      label: 'Audit events',
      description: 'Trace sensitive operations',
    },
    gameAccounts: {
      label: 'Game accounts',
      description: 'Review and verify accounts',
    },
    siteSettings: {
      label: 'Site settings',
      description: 'Brand, landing page, and public announcement',
    },
    matches: {
      label: 'Matches',
      description: 'Match state and lifecycle',
    },
    results: {
      label: 'Result conflicts',
      description: 'Results awaiting a decision',
    },
    disputes: {
      label: 'Disputes',
      description: 'Dispute review queue',
    },
    matchmaking: {
      label: 'Matchmaking',
      description: 'Requests and proposals',
    },
    ratings: {
      label: 'Ratings',
      description: 'Review and apply ratings',
    },
    wallets: {
      label: 'Wallet and ledger',
      description: 'Balances and transactions',
    },
    finance: {
      label: 'Match finance',
      description: 'Reservations and refunds',
    },
    settlements: {
      label: 'Settlements',
      description: 'Settlement and reconciliation',
    },
    notifications: {
      label: 'Notifications',
      description: 'Outbox and dead-letter',
    },
    support: {
      label: 'Support operations',
      description: 'Controlled recovery actions',
    },
  },
};

export const adminDictionaries: Record<AppLocale, AdminDictionary> = {
  fa,
  en,
};
