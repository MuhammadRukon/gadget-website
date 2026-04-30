import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Lightweight edge guard:
 *
 * - `/dashboard/**` and `/api/admin/**` require an authenticated user
 *   with the ADMIN role. Customers get a 403 (or are bounced to /login
 *   if not signed in at all).
 * - Everything else passes through. Per-route auth checks are still
 *   performed inside services so middleware can be bypassed without a
 *   security regression (defense in depth).
 *
 * We rely on Auth.js's JWT session so this runs on the edge with no
 * database round-trip.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAdmin = pathname.startsWith('/dashboard') || pathname.startsWith('/api/admin');

  if (!needsAdmin) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
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

  if (user.role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Admin role required' },
        { status: 403 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
};
