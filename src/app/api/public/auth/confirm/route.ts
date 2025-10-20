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
         *
         * IMPORTANT: We ALWAYS redirect to success after OTP verification succeeds,
         * even if user creation fails. The critical part is email verification.
         * User creation failures are logged but don't block the flow.
         */

        try {
          // Get the authenticated user
          const { data: { user: authUser } } = await supabase.auth.getUser()

          if (authUser) {
            // Check if user exists in public.users
            const { error: checkError } = await supabase
              .from('users')
              .select('id')
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
              } else {
                console.log('User created successfully via email confirmation:', authUser.id)
              }

              // Create default user_settings for new user
              const { error: settingsError } = await supabase
                .from('user_settings')
                .insert({
                  user_id: authUser.id,
                  quiz_settings: DEFAULT_QUIZ_SETTINGS,
                  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
                  ui_settings: DEFAULT_UI_SETTINGS
                })

              if (settingsError) {
                console.error('Error creating user settings for new user:', settingsError)
                // Don't fail - user can still proceed
              } else {
                console.log('User settings created successfully for new user:', authUser.id)
              }
            }

            // Final safeguard: Ensure user_settings exist for all users
            const { data: existingSettings } = await supabase
              .from('user_settings')
              .select('user_id')
              .eq('user_id', authUser.id)
              .single()

            if (!existingSettings) {
              console.log('Creating missing user_settings as final safeguard:', authUser.id)
              const { error: settingsError } = await supabase
                .from('user_settings')
                .insert({
                  user_id: authUser.id,
                  quiz_settings: DEFAULT_QUIZ_SETTINGS,
                  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
                  ui_settings: DEFAULT_UI_SETTINGS
                })

              if (settingsError) {
                console.error('Error creating user settings in final safeguard:', settingsError)
                // Don't fail - user can still proceed
              } else {
                console.log('User settings created successfully in final safeguard:', authUser.id)
              }
            }
          }
        } catch (userCreationError) {
          // Log any errors during user creation but don't fail the verification
          console.error('Error during user creation process:', userCreationError)
          // Continue to success redirect - verification was successful
        }

        // ALWAYS redirect to success after OTP verification succeeds
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
          // For signup verification, check if user was already verified
          // Note: We can't use getUser() here because there's no session yet
          // Instead, check if the email from the token is already verified in auth.users

          // Extract email from token if possible, or check using admin client
          // Since we can't verify without email, redirect to already-verified page
          // which is safer than showing "expired" when they might be verified
          console.log('Email verification link expired or already used')
          console.log('Redirecting to already-verified page (safer than link-expired)')
          return NextResponse.redirect(`${origin}/email-already-verified`)
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
