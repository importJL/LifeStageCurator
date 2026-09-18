import { NextResponse, type NextRequest } from 'next/server';
import { demoSessionKey } from './app/demo-auth';

export function middleware(request: NextRequest) {
  if (request.cookies.has(demoSessionKey)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/articles/:path*']
};
