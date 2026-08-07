import type { AppLocale } from '@/i18n/config';

type MatchStatusPresentation = Readonly<Record<string, { label: string; description: string }>>;

const fa: MatchStatusPresentation = {
  CREATED: { label: 'ایجاد شده', description: 'مسابقه در حال آماده‌سازی است.' },
  AWAITING_READY: {
    label: 'منتظر آمادگی',
    description: 'شرکت‌کنندگان باید آمادگی را اعلام کنند.',
  },
  READY: { label: 'آماده شروع', description: 'هر دو طرف آماده‌اند.' },
  IN_PROGRESS: { label: 'در حال بازی', description: 'مسابقه شروع شده است.' },
  AWAITING_RESULT: { label: 'منتظر نتیجه', description: 'نتیجه را ثبت کنید.' },
  RESULT_CONFLICT: { label: 'تضاد نتیجه', description: 'نتایج ثبت‌شده هم‌خوان نیستند.' },
  COMPLETED: { label: 'تکمیل‌شده', description: 'نتیجه نهایی شده است.' },
  CANCELLED: { label: 'لغوشده', description: 'مسابقه لغو شده است.' },
  EXPIRED: { label: 'منقضی', description: 'مهلت این مسابقه گذشته است.' },
  VOIDED: { label: 'باطل‌شده', description: 'مسابقه بدون نتیجه معتبر بسته شده است.' },
};

const en: MatchStatusPresentation = {
  CREATED: { label: 'Created', description: 'The match is being prepared.' },
  AWAITING_READY: {
    label: 'Awaiting ready',
    description: 'Participants must confirm readiness.',
  },
  READY: { label: 'Ready', description: 'Both participants are ready.' },
  IN_PROGRESS: { label: 'In progress', description: 'The match has started.' },
  AWAITING_RESULT: { label: 'Awaiting result', description: 'Submit the match result.' },
  RESULT_CONFLICT: { label: 'Result conflict', description: 'Submitted results do not agree.' },
  COMPLETED: { label: 'Completed', description: 'The final result is confirmed.' },
  CANCELLED: { label: 'Cancelled', description: 'The match was cancelled.' },
  EXPIRED: { label: 'Expired', description: 'The match deadline has passed.' },
  VOIDED: { label: 'Voided', description: 'The match closed without a valid result.' },
};

export function matchStatusFor(locale: AppLocale): MatchStatusPresentation {
  return locale === 'fa' ? fa : en;
}

export function statusLabel(status: string, locale: AppLocale = 'fa'): string {
  return (
    matchStatusFor(locale)[status]?.label ??
    (locale === 'fa' ? 'وضعیت نامشخص' : 'Unknown status')
  );
}

export function notificationMatchHref(
  type: string,
  data: Readonly<Record<string, unknown>>,
): string | null {
  if (type === 'MATCHMAKING_PROPOSAL_CREATED') return '/matchmaking/proposals';
  const id =
    typeof data.matchId === 'string' && /^[0-9a-f-]{36}$/i.test(data.matchId) ? data.matchId : null;
  if (!id) return null;
  if (['MATCH_RESULT_WAITING', 'MATCH_RESULT_CONFLICT'].includes(type))
    return `/matches/${id}/result`;
  if (
    ['MATCH_DISPUTE_OPENED', 'MATCH_DISPUTE_RESPONSE_RECEIVED', 'MATCH_DISPUTE_RESOLVED'].includes(
      type,
    )
  )
    return `/matches/${id}/dispute`;
  return `/matches/${id}`;
}
