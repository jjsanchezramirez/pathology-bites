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
     * ULTRA-MINIMAL: Only match paths that absolutely need middleware
     * Handle other redirects at page level to minimize function invocations
     */
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/admin/:path*',  // Add admin API routes for centralized auth
    '/api/user/:path*',   // Add user API routes for centralized auth
    '/api/quiz/:path*'    // Add quiz API routes for centralized auth
  ],
  // Use Node.js runtime instead of Edge Runtime to support Supabase
  runtime: 'nodejs'
}