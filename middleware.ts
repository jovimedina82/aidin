import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/middleware';
import { getBaseUrl } from '@/lib/config';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|images|api/auth).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);

  // Skip middleware for API routes (they handle their own auth)
  if (url.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const user = await getCurrentUser(req);
  const isLogin = url.pathname === '/login';

  if (user && isLogin) {
    const res = NextResponse.redirect(new URL('/dashboard', getBaseUrl(req)));
    return res;
  }

  const publicPaths = new Set<string>(['/login']);
  const isPublic = publicPaths.has(url.pathname);
  if (!user && !isPublic) {
    const res = NextResponse.redirect(new URL('/login', getBaseUrl(req)));
    return res;
  }

  return NextResponse.next();
}
