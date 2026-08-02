import { getWebConfig } from '@/config';
import { NextRequest, NextResponse } from 'next/server';
import { requestOriginForHost } from '@/lib/host-policy';

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const allowedRoots = new Set([
  'auth',
  'profile',
  'notifications',
  'notification-preferences',
  'catalog',
  'player-game-accounts',
  'game-accounts',
  'matchmaking',
  'matches',
  'wallet',
  'ratings',
  'leaderboards',
  'admin',
]);
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path[0] || !allowedRoots.has(path[0])) {
    return NextResponse.json(
      { error: { code: 'PROXY_ROUTE_REJECTED', message: 'Route is not available.' } },
      { status: 404 },
    );
  }
  const writes = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const requestOrigin = requestOriginForHost(request.headers.get('host'));
  if (!requestOrigin) {
    return NextResponse.json(
      { error: { code: 'HOST_REJECTED', message: 'Host is not allowed.' } },
      { status: 421 },
    );
  }
  if (writes) {
    if (
      request.headers.get('origin') !== requestOrigin ||
      !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
    ) {
      return NextResponse.json(
        { error: { code: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed.' } },
        { status: 403 },
      );
    }
  }
  const target = `${getWebConfig().server.apiBaseUrl}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const cookie = request.headers.get('cookie');
  const requestId = request.headers.get('x-request-id');
  const response = await fetch(target, {
    method: request.method,
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(requestId ? { 'x-request-id': requestId } : {}),
      Origin: requestOrigin,
    },
    ...(body === undefined ? {} : { body }),
    signal: AbortSignal.timeout(8_000),
  });
  const outgoing = new NextResponse(response.body, { status: response.status });
  for (const header of ['content-type', 'retry-after', 'x-request-id', 'set-cookie']) {
    const value = response.headers.get(header);
    if (value) outgoing.headers.set(header, value);
  }
  outgoing.headers.set('Cache-Control', 'no-store');
  return outgoing;
}
export const dynamic = 'force-dynamic';
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
void methods;
