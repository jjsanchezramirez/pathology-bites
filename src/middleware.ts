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
     * ULTRA-MINIMAL: Only match absolutely essential paths
     * Skip most routes entirely to reduce function invocations
     */
    '/dashboard/:path*',
    '/admin/:path*'
  ],
}