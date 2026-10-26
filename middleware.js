import { NextResponse } from 'next/server';
import { COOKIE, verifyToken } from '@/lib/auth';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];
const ADMIN_PAGES = ['/dashboard/audit', '/dashboard/users'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  const isApi = pathname.startsWith('/api/');

  if (!payload) {
    if (isApi) {
      return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Please log in' } }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // Employees only get their own page (API routes enforce roles again inside withAuth)
    if (!isApi && payload.role === 'employee' && !pathname.startsWith('/dashboard/my')) {
    return NextResponse.redirect(new URL('/dashboard/my', req.url));
  }
  if (!isApi && ADMIN_PAGES.some((p) => pathname.startsWith(p)) && payload.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/api/:path*'] };