const sensitiveKey =
  /password|secret|token|authorization|cookie|credential|private.?key|api.?key|database.?url|smtp.?password/i;
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

export function redactSensitive(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return '[MAX_DEPTH]';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1, seen));
  if (value instanceof Error)
    return {
      name: value.name,
      message: redactString(value.message),
      ...(value.cause === undefined
        ? {}
        : { cause: redactSensitive(value.cause, depth + 1, seen) }),
    };
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) continue;
    result[key] = sensitiveKey.test(key) ? '[REDACTED]' : redactSensitive(item, depth + 1, seen);
  }
  return result;
}

function redactString(input: string): string {
  return input
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:token|secret|password|key)=)[^&#\s]+/gi, '$1[REDACTED]');
}
