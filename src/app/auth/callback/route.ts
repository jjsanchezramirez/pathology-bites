// src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next')

    if (code) {
      const cookieStore = await cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      // Exchange code for session
      await supabase.auth.exchangeCodeForSession(code)

      // If it's a recovery flow, redirect to reset password
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }

      // Get the user's info for normal auth flow
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError

      if (user) {
        // Check if user is verified
        if (!user.email_confirmed_at) {
          return NextResponse.redirect(new URL('/verify-email', request.url))
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from("users")
          .select('role')
          .eq('email', user.email)
          .single()

        if (existingProfile) {
          // Profile exists - update if it's a Google login
          if (user.app_metadata.provider === 'google') {
            await supabase
              .from("users")
              .update({
                first_name: user.user_metadata?.given_name || existingProfile.first_name,
                last_name: user.user_metadata?.family_name || existingProfile.last_name,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id)
          }
          
          // Redirect based on role
          if (existingProfile.role === 'admin') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url))
          }
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Create new profile for verified user
        const { error: profileError } = await supabase
          .from("users")
          .insert({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            role: "user",
            user_type: user.user_metadata?.user_type || 'resident',
            status: "active"
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          throw profileError
        }

        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    throw new Error('No code or user found')
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth-callback-error', request.url)
    )
  }
}