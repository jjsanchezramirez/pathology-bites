// src/app/api/public/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS
} from '@/shared/constants/user-settings-defaults'

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
        /**
         * USER CREATION NOTE:
         * User creation in public.users and user_settings is handled in APPLICATION CODE.
         * This ensures all users have corresponding entries in both tables.
         *
         * Process:
         * 1. Get the authenticated user from session
         * 2. Check if user exists in public.users
         * 3. If not, create user record with metadata from auth.users
         * 4. Create default user_settings for the new user
         */

        // Get the authenticated user
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          // Check if user exists in public.users
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, status')
            .eq('id', authUser.id)
            .single()

          // If user doesn't exist, create them
          if (checkError && checkError.code === 'PGRST116') {
            // Create user in public.users
            const { error: createError } = await supabase
              .from('users')
              .insert({
                id: authUser.id,
                email: authUser.email || '',
                first_name: authUser.user_metadata?.first_name || '',
                last_name: authUser.user_metadata?.last_name || '',
                user_type: authUser.user_metadata?.user_type || 'other',
                role: 'user',
                status: 'active'
              })

            if (createError) {
              console.error('Error creating user:', createError)
              // Don't fail - user can still proceed
            }
          } else if (existingUser?.status === 'deleted') {
            // User exists but is soft-deleted - restore them
            console.log('Restoring soft-deleted user via email confirmation:', { userId: authUser.id, email: authUser.email })

            const { error: restoreError } = await supabase
              .from('users')
              .update({
                status: 'active',
                deleted_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', authUser.id)

            if (restoreError) {
              console.error('Error restoring user:', restoreError)
              // Don't fail - user can still proceed
            } else {
              console.log('User restored successfully via email confirmation:', authUser.id)
            }

            // Check if user_settings exist before creating
            const { data: existingSettings } = await supabase
              .from('user_settings')
              .select('user_id')
              .eq('user_id', authUser.id)
              .single()

            if (!existingSettings) {
              console.log('Creating missing user_settings for restored user:', authUser.id)
              const { error: settingsError } = await supabase
                .from('user_settings')
                .insert({
                  user_id: authUser.id,
                  quiz_settings: DEFAULT_QUIZ_SETTINGS,
                  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
                  ui_settings: DEFAULT_UI_SETTINGS
                })

              if (settingsError) {
                console.error('Error creating user settings:', settingsError)
                // Don't fail - user can still proceed
              }
            }
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
