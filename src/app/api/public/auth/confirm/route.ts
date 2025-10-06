// src/app/api/public/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const token = searchParams.get('token') // Add support for token parameter
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  console.log('Auth confirm route called:', {
    token_hash: !!token_hash,
    token: !!token,
    code: !!code,
    type,
    next
  })

  // Handle code parameter (for password reset)
  if (code && type === 'recovery') {
    const supabase = await createClient()

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('Code verification successful for password reset')
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('Code verification failed:', error)

      // Handle expired password reset codes
      if (error.message.includes('expired') || error.message.includes('invalid') ||
          error.message.includes('already been used') || error.code === 'otp_expired') {
        console.log('Password reset code expired or invalid, redirecting to link-expired page')
        return NextResponse.redirect(`${origin}/link-expired?type=recovery`)
      }

      return NextResponse.redirect(
        `${origin}/auth-error?error=verification_failed&description=${encodeURIComponent(error.message)}`
      )
    }
  }

  // Handle token_hash or token parameter
  if ((token_hash || token) && type) {
    const supabase = await createClient()

    // Use token_hash if available, otherwise use token as token_hash
    const verificationToken = token_hash || token

    if (!verificationToken) {
      console.error('No verification token found')
      return NextResponse.redirect(`${origin}/auth-error?error=verification_failed&description=No verification token found`)
    }

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: verificationToken,
    })

    if (!error) {
      console.log('OTP verification successful')
      
      // Handle different verification types
      if (type === 'signup' || type === 'email') { // Accept both types
        // Create user profile if it doesn't exist
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          console.log('Creating user profile for:', user.email)
          
          const { error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

          if (profileError && profileError.code === 'PGRST116') {
            // User doesn't exist in database, create profile
            const insertResult = await supabase.from('users').insert({
              id: user.id,
              email: user.email,
              first_name: user.user_metadata.first_name || '',
              last_name: user.user_metadata.last_name || '',
              user_type: user.user_metadata.user_type || 'other',
              role: 'user',
              status: 'active'
            })

            console.log('User profile created:', insertResult.error ? 'failed' : 'success')

            // Create default user settings for new user
            await supabase.rpc('create_user_settings_for_new_user', { p_user_id: user.id })
            console.log('User settings created for new user')
          }
        }
        
        console.log('Redirecting to email-verified page')
        return NextResponse.redirect(`${origin}/email-verified`)
      } else if (type === 'recovery') {
        console.log('Password recovery, redirecting to:', next)
        return NextResponse.redirect(`${origin}${next}`)
      } else if (type === 'email_change') {
        return NextResponse.redirect(`${origin}/dashboard?message=Email updated successfully`)
      }
      
      // Default redirect
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('OTP verification failed:', error)

      // Handle expired or invalid links
      if (error.code === 'otp_expired') {
        if (type === 'recovery') {
          console.log('Password reset link expired, redirecting to link-expired page')
          return NextResponse.redirect(`${origin}/link-expired?type=recovery`)
        } else if (type === 'signup' || type === 'email') {
          // Check if user is already verified
          const { data: { user } } = await supabase.auth.getUser()

          if (user && user.email_confirmed_at) {
            console.log('User is already verified, redirecting to already-verified page')
            return NextResponse.redirect(`${origin}/email-already-verified`)
          }

          // If not verified, show expired link page
          console.log('Email verification link expired, redirecting to link-expired page')
          const emailParam = user?.email ? `&email=${encodeURIComponent(user.email)}` : ''
          return NextResponse.redirect(`${origin}/link-expired?type=${type}${emailParam}`)
        }
      }

      // For other errors, redirect to generic auth error page
      console.log('Other verification error, redirecting to auth-error page')
      return NextResponse.redirect(
        `${origin}/auth-error?error=verification_failed&description=${encodeURIComponent(error.message)}`
      )
    }
  } else {
    console.error('Missing token_hash/token or type')
  }

  // redirect the user to an error page with instructions
  console.log('Redirecting to auth error page')
  return NextResponse.redirect(`${origin}/auth-error?error=verification_failed&description=Missing verification parameters`)
}
