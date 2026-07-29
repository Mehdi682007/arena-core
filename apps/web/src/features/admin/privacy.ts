const sensitive =
  /password|secret|token|authorization|cookie|session|credential|privatekey|apikey|databaseurl|smtppassword|(^|_)ip($|_)|email|normalizedhandle|walletid|ledgeraccountid|escrowaccountid|revieweruserid|adminnote|providererror|requestfingerprint/i;

export function redactAdminValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[محدودشده]';
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => redactAdminValue(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, item]) => [
          key,
          sensitive.test(key) ? '[حذف‌شده]' : redactAdminValue(item, depth + 1),
        ]),
    );
  return ['string', 'number', 'boolean'].includes(typeof value) || value === null
    ? value
    : '[پشتیبانی‌نشده]';
}

export const safeAdminHref = (kind: 'user' | 'match' | 'outbox' | 'audit', id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return null;
  const routes = {
    user: `/admin/users/${encodeURIComponent(id)}/timeline`,
    match: `/admin/matches/${encodeURIComponent(id)}/timeline`,
    outbox: `/admin/notifications/outbox/${encodeURIComponent(id)}`,
    audit: `/admin/audit/${encodeURIComponent(id)}`,
  };
  return routes[kind];
};
