// src/app/api/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  console.log('Auth confirm route called:', { token_hash: !!token_hash, type, next })

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
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
      
      // Check if the error is because the link was already used
      if (error.code === 'otp_expired' && (type === 'signup' || type === 'email')) {
        // Check if user is already verified
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user && user.email_confirmed_at) {
          console.log('User is already verified, redirecting to already-verified page')
          return NextResponse.redirect(`${origin}/email-already-verified`)
        }
        
        // If not verified, show expired link error
        console.log('Link expired and user not verified, showing error')
        return NextResponse.redirect(`${origin}/auth-error?error=expired_link&description=Verification link has expired. Please request a new one.`)
      }
    }
  } else {
    console.error('Missing token_hash or type')
  }

  // redirect the user to an error page with instructions
  console.log('Redirecting to auth error page')
  return NextResponse.redirect(`${origin}/auth-error?error=verification_failed&description=Failed to verify email`)
}