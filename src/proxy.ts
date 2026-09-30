import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Edge guard for admin-only routes. Verifies the JWT (role is baked in
 * at sign-in, see authOptions.ts `jwt` callback) rather than just
 * checking that a session cookie exists — a CUSTOMER's valid session
 * no longer passes this check. This is verification only, not
 * revocation: a demoted admin's existing token still passes until it
 * expires. Route-level `requireAdminSession()` and the dashboard
 * layout's server-side role check remain the actual enforcement of
 * record; this file (Next's middleware convention, named `proxy.ts` in
 * this project) is a fast-fail layer in front of them.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAdmin = pathname.startsWith('/dashboard') || pathname.startsWith('/api/admin');
  const needsUser = pathname.startsWith('/account');

  if (!needsAdmin && !needsUser) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // Admin routes require the ADMIN role; /account only requires any
  // authenticated user. Verifying the JWT here (not just cookie
  // presence) means a CUSTOMER token can't reach admin routes.
  const authorized = needsAdmin ? !!token && token.role === 'ADMIN' : !!token;

  if (!authorized) {
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
  matcher: ['/dashboard/:path*', '/api/admin/:path*', '/account/:path*'],
};
