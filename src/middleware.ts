// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/shared/services/middleware'

export async function middleware(request: NextRequest) {
  // Skip middleware for static files only (API routes handled in updateSession)
  if (request.nextUrl.pathname.startsWith('/_next/') ||
      request.nextUrl.pathname.includes('.') ||
      request.nextUrl.pathname.startsWith('/data/')) {
    return
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Only match paths that actually need middleware:
     * - /dashboard/* (protected routes)
     * - /admin/* (admin routes)
     * - /debug/* (debug protection)
     * - / (root for maintenance/coming soon)
     * - /login, /signup (auth redirects)
     */
    '/(dashboard|admin|debug)/:path*',
    '/',
    '/login',
    '/signup',
    '/verify-email',
    '/check-email',
    '/email-verified',
    '/email-already-verified'
  ],
}