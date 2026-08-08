import { messageForCode } from '../errors/messages';

export interface FrontendApiError {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string | undefined;
  readonly fieldErrors?: Readonly<Record<string, string>> | undefined;
  readonly status: number;
  readonly retryAfterSeconds?: number | undefined;
}

function currentLocale(): 'fa' | 'en' {
  if (typeof document === 'undefined') return 'fa';

  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fa';
}

export class ApiError extends Error implements FrontendApiError {
  public override readonly name = 'ApiError';
  public constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly fieldErrors?: Readonly<Record<string, string>>,
    public readonly retryAfterSeconds?: number,
  ) {
    super(messageForCode(code, currentLocale()));
  }
}

export async function normalizeApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }
  const envelope =
    typeof payload === 'object' && payload !== null && 'error' in payload
      ? (payload as { error?: unknown }).error
      : undefined;
  const safe =
    typeof envelope === 'object' && envelope !== null ? (envelope as Record<string, unknown>) : {};
  const code =
    typeof safe.code === 'string'
      ? safe.code
      : response.status === 401
        ? 'UNAUTHENTICATED'
        : response.status === 403
          ? 'FORBIDDEN'
          : response.status === 429
            ? 'RATE_LIMITED'
            : response.status >= 500
              ? 'INTERNAL_SERVER_ERROR'
              : 'REQUEST_FAILED';
  const requestId =
    typeof safe.requestId === 'string'
      ? safe.requestId
      : (response.headers.get('x-request-id') ?? undefined);
  const details =
    typeof safe.details === 'object' && safe.details !== null
      ? (safe.details as Record<string, unknown>)
      : undefined;
  const fieldErrors = details
    ? Object.fromEntries(
        Object.entries(details).flatMap(([key, value]) =>
          Array.isArray(value) && typeof value[0] === 'string' ? [[key, value[0]]] : [],
        ),
      )
    : undefined;
  const retry = Number(response.headers.get('retry-after'));
  return new ApiError(
    code,
    response.status,
    requestId,
    fieldErrors,
    Number.isFinite(retry) ? retry : undefined,
  );
}
