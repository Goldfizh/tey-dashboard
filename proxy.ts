import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'tey_auth';

export function proxy(request: NextRequest) {
  const isAuthenticated = request.cookies.get(COOKIE_NAME)?.value === '1';
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && pathname !== '/login') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/login|_next/static|_next/image|favicon.ico).*)'],
};
