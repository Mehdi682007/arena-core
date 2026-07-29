export const matchStatus: Readonly<Record<string, { label: string; description: string }>> = {
  CREATED: { label: 'ایجاد شده', description: 'مسابقه در حال آماده‌سازی است.' },
  AWAITING_READY: { label: 'منتظر آمادگی', description: 'شرکت‌کنندگان باید آمادگی را اعلام کنند.' },
  READY: { label: 'آماده شروع', description: 'هر دو طرف آماده‌اند.' },
  IN_PROGRESS: { label: 'در حال بازی', description: 'مسابقه شروع شده است.' },
  AWAITING_RESULT: { label: 'منتظر نتیجه', description: 'نتیجه را ثبت کنید.' },
  RESULT_CONFLICT: { label: 'تضاد نتیجه', description: 'نتایج ثبت‌شده هم‌خوان نیستند.' },
  COMPLETED: { label: 'تکمیل‌شده', description: 'نتیجه نهایی شده است.' },
  CANCELLED: { label: 'لغوشده', description: 'مسابقه لغو شده است.' },
  EXPIRED: { label: 'منقضی', description: 'مهلت این مسابقه گذشته است.' },
  VOIDED: { label: 'باطل‌شده', description: 'مسابقه بدون نتیجه معتبر بسته شده است.' },
};
export function statusLabel(status: string) {
  return matchStatus[status]?.label ?? 'وضعیت نامشخص';
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
