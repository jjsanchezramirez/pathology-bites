// src/middleware.ts
import { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Handle OAuth redirects
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    // This is an OAuth callback that was redirected to production
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    
    if (code) {
      // Redirect to the local callback handler, preserving the state parameter
      const redirectUrl = new URL(`/api/auth/callback?code=${code}`, request.url);
      if (state) redirectUrl.searchParams.append('state', state);
      console.log('Redirecting OAuth callback to:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Now use the updateSession function we implemented
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}