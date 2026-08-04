import type { AppLocale } from './config';

type AdminNavigationItemText = {
  label: string;
  description: string;
};

type AdminNavigationGroupText = {
  label: string;
};

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
  groups: Record<string, AdminNavigationGroupText>;
  items: Record<string, AdminNavigationItemText>;
};

const fa: AdminDictionary = {
  operationsCenter: 'مرکز عملیات',
  adminNavigation: 'ناوبری مدیریت',
  administration: 'مدیریت',
  production: 'Production',
  quickSearch: 'جستجوی سریع',
  securityControlled: 'دسترسی‌ها توسط سرور کنترل می‌شوند',
  backToApplication: 'بازگشت به برنامه',
  openMenu: 'بازکردن منوی مدیریت',
  closeMenu: 'بستن منوی مدیریت',
  switchToPersian: 'تغییر زبان به فارسی',
  switchToEnglish: 'تغییر زبان به انگلیسی',
  groups: {
    operations: { label: 'مرکز عملیات' },
    competition: { label: 'رقابت و بازیکنان' },
    finance: { label: 'مالی' },
    communications: { label: 'ارتباطات و بازیابی' },
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
  groups: {
    operations: { label: 'Operations center' },
    competition: { label: 'Competition and players' },
    finance: { label: 'Finance' },
    communications: { label: 'Communications and recovery' },
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
