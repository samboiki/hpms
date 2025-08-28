import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get the host to determine which port we're on
  const host = request.headers.get('host')
  const isAdminPort = host?.includes(':4000')
  const isMarketingPort = host?.includes(':3000')
  
  // Admin portal (port 4000) logic
  if (isAdminPort) {
    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/dashboard/', '/practices', '/analytics', '/settings']
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
    
    // If accessing root or any protected route without auth, redirect to login
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    
    // Allow auth routes to pass through
    if (pathname.startsWith('/auth/')) {
      return NextResponse.next()
    }
    
    // For now, allow dashboard routes to pass (auth will be handled by the app)
    // In production, you would check for session/token here
    return NextResponse.next()
  }
  
  // Marketing portal (port 3000) - stay on landing page
  if (isMarketingPort) {
    return NextResponse.next()
  }
  
  // Default behavior for any other case
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}