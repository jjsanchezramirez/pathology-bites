// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Check if we need to standardize the domain in production
  const expectedDomain = process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === 'production' && 
      expectedDomain && 
      request.headers.get('host') !== new URL(expectedDomain).host &&
      !request.nextUrl.pathname.startsWith('/_next/') &&
      !request.nextUrl.pathname.includes('.')) {
    
    // Create the new URL with the correct domain
    const newUrl = new URL(request.nextUrl.pathname, expectedDomain);
    
    // Copy all query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });
    
    console.log(`Domain mismatch, redirecting to: ${newUrl.toString()}`);
    return NextResponse.redirect(newUrl.toString());
  }
  
  // Handle OAuth redirects
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    // This is an OAuth callback that was redirected to production
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    
    if (code) {
      // Redirect to the local callback handler, preserving the state parameter
      const redirectUrl = new URL(`/api/auth/callback`, request.url);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);
      
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