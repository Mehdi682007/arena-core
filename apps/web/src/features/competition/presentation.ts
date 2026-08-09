import type { AppLocale } from '@/i18n/config';
import { presentStatus } from '../../i18n/presentation';

const descriptions: Readonly<Record<string, Readonly<Record<AppLocale, string>>>> = {
  CREATED: { fa: 'مسابقه در حال آماده‌سازی است.', en: 'The match is being prepared.' },
  AWAITING_READY: {
    fa: 'شرکت‌کنندگان باید آمادگی را اعلام کنند.',
    en: 'Players must confirm they are ready.',
  },
  READY: { fa: 'هر دو طرف آماده‌اند.', en: 'Both players are ready.' },
  IN_PROGRESS: { fa: 'مسابقه شروع شده است.', en: 'The match is in progress.' },
  AWAITING_RESULT: { fa: 'نتیجه را ثبت کنید.', en: 'Submit the match result.' },
  RESULT_CONFLICT: {
    fa: 'نتایج ثبت‌شده هم‌خوان نیستند.',
    en: 'The submitted results do not agree.',
  },
  COMPLETED: { fa: 'نتیجه نهایی شده است.', en: 'The result is final.' },
  CANCELLED: { fa: 'مسابقه لغو شده است.', en: 'The match was cancelled.' },
  EXPIRED: { fa: 'مهلت این مسابقه گذشته است.', en: 'The match deadline has passed.' },
  VOIDED: {
    fa: 'مسابقه بدون نتیجه معتبر بسته شده است.',
    en: 'The match closed without a valid result.',
  },
};

export function statusLabel(status: string, locale: AppLocale) {
  return presentStatus(status, locale);
}

export function statusDescription(status: string, locale: AppLocale) {
  return (
    descriptions[status]?.[locale] ??
    (locale === 'fa' ? 'جزئیات وضعیت در دسترس نیست.' : 'Status details are unavailable.')
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
