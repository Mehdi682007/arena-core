import { NotificationError } from './notification-errors';
import { validatePayload } from './notification-policies';
import type {
  NotificationLocale,
  NotificationPayloadEnvelope,
  NotificationPriority,
  NotificationType,
} from './notification-types';

export interface RenderedNotificationTemplate {
  readonly subject: string;
  readonly body: string;
  readonly email?: Readonly<{ subject: string; text: string; html: string }>;
  readonly priority: NotificationPriority;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
const label = (payload: NotificationPayloadEnvelope, key: string, fallback: string): string => {
  const value = payload.data[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
};

const subjects: Record<NotificationType, Readonly<{ fa: string; en: string }>> = {
  MATCHMAKING_PROPOSAL_CREATED: { fa: 'پیشنهاد مسابقه جدید', en: 'New match proposal' },
  MATCHMAKING_PROPOSAL_ACCEPTED: { fa: 'پیشنهاد مسابقه پذیرفته شد', en: 'Match proposal accepted' },
  MATCH_READY_REQUIRED: { fa: 'تأیید آمادگی لازم است', en: 'Ready confirmation required' },
  MATCH_STARTED: { fa: 'مسابقه شروع شد', en: 'Match started' },
  MATCH_RESULT_WAITING: { fa: 'در انتظار نتیجه مسابقه', en: 'Waiting for match result' },
  MATCH_RESULT_CONFIRMED: { fa: 'نتیجه مسابقه تأیید شد', en: 'Match result confirmed' },
  MATCH_RESULT_CONFLICT: { fa: 'اختلاف در نتیجه مسابقه', en: 'Match result conflict' },
  MATCH_DISPUTE_OPENED: { fa: 'اعتراض مسابقه ثبت شد', en: 'Match dispute opened' },
  MATCH_DISPUTE_RESPONSE_RECEIVED: {
    fa: 'پاسخ اعتراض دریافت شد',
    en: 'Dispute response received',
  },
  MATCH_DISPUTE_RESOLVED: { fa: 'اعتراض مسابقه حل شد', en: 'Match dispute resolved' },
  MATCH_SETTLEMENT_COMPLETED: { fa: 'تسویه مسابقه تکمیل شد', en: 'Match settlement completed' },
  RATING_UPDATED: { fa: 'امتیاز رقابتی به‌روزرسانی شد', en: 'Competitive rating updated' },
  SECURITY_SIGN_IN: { fa: 'ورود جدید به حساب', en: 'New account sign-in' },
};

export function renderNotificationTemplate(
  type: NotificationType,
  locale: NotificationLocale,
  payloadInput: NotificationPayloadEnvelope,
): RenderedNotificationTemplate {
  const payload = validatePayload(payloadInput);
  const title = (subjects as Partial<typeof subjects>)[type]?.[locale];
  if (!title) throw new NotificationError('NOTIFICATION_TEMPLATE_NOT_FOUND');
  const context =
    type === 'RATING_UPDATED'
      ? `${label(payload, 'game', 'Arena')}: ${label(payload, 'rating', '—')} (${label(payload, 'delta', '0')})`
      : type === 'MATCHMAKING_PROPOSAL_CREATED'
        ? `${label(payload, 'game', 'Arena')} — ${label(payload, 'mode', 'Match')}`
        : type === 'MATCH_SETTLEMENT_COMPLETED'
          ? `${label(payload, 'amount', '0')} Arena Point`
          : label(payload, 'status', label(payload, 'matchId', 'Arena'));
  const body = locale === 'en' ? `${title}: ${context}` : `${title}: ${context}`;
  const priority: NotificationPriority =
    type === 'SECURITY_SIGN_IN' || type === 'MATCH_READY_REQUIRED' ? 'HIGH' : 'NORMAL';
  return Object.freeze({
    subject: title,
    body,
    email: Object.freeze({
      subject: title,
      text: body,
      html: `<p>${escapeHtml(body)}</p>`,
    }),
    priority,
  });
}
