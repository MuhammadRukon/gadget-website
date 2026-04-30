import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

function hasSessionToken(req: NextRequest) {
  return SESSION_COOKIE_NAMES.some((name) => !!req.cookies.get(name)?.value);
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAdmin = pathname.startsWith('/dashboard') || pathname.startsWith('/api/admin');

  if (!needsAdmin) return NextResponse.next();

  const isAuthenticated = hasSessionToken(req);
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
};
