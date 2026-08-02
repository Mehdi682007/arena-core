import { NextRequest, NextResponse } from 'next/server';
import { canonicalHostname, configuredHostname } from '@/lib/host-policy';

const adminSupportPath =
  /^(?:\/admin(?:\/|$)|\/login$|\/forgot-password$|\/reset-password$|\/verify-email$|\/api\/backend(?:\/|$)|\/api\/health$|\/health$|\/_next(?:\/|$)|\/(?:favicon\.ico|robots\.txt|sitemap\.xml)$)/;

export function proxy(request: NextRequest): NextResponse {
  const hostname = canonicalHostname(request.headers.get('host'));
  const publicHostname = configuredHostname(process.env.WEB_BASE_URL);
  const adminHostname = configuredHostname(process.env.ADMIN_ORIGIN);
  if (
    !hostname ||
    !publicHostname ||
    !adminHostname ||
    ![publicHostname, adminHostname].includes(hostname)
  ) {
    return new NextResponse(null, { status: 421 });
  }
  const path = request.nextUrl.pathname;
  if (hostname === publicHostname && (path === '/admin' || path.startsWith('/admin/'))) {
    return new NextResponse(null, { status: 404 });
  }
  if (hostname === adminHostname) {
    if (path === '/') return NextResponse.redirect(new URL('/admin', request.url), 307);
    if (!adminSupportPath.test(path)) return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
