import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the hostname (domain)
  const hostname = request.headers.get('host') || '';
  
  // For development, check if running on different ports
  const url = request.nextUrl.clone();
  
  // Add the hostname to headers so we can access it in server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-practice-domain', hostname);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};