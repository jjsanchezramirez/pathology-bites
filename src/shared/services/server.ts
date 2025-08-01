// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  try {
    // IMPORTANT: Await the cookies() call in Next.js 15
    const cookieStore = await cookies()

    // Use environment variables directly for server-side
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      console.error('[Supabase Server] Missing environment variables:', { hasUrl: !!url, hasAnonKey: !!anonKey })
      throw new Error('Missing Supabase environment variables')
    }

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (cookieError) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.warn('[Supabase Server] Cookie setting failed (expected in Server Components):', cookieError)
          }
        }
      },
    }
  )
  } catch (error) {
    console.error('[Supabase Server] Failed to create client:', error)
    throw error
  }
}