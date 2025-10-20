// src/lib/auth/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/services/server'
import { z } from 'zod'
import { validateCSRFToken } from '@/features/auth/utils/csrf-protection'
import { headers, cookies } from 'next/headers'
import { loginRateLimiter, getClientIP } from '@/features/auth/utils/rate-limiter'

// Validation schema for signup
const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.enum(["student", "resident", "fellow", "attending", "other"], {
    invalid_type_error: "Please select your role",
  }),
})

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // Validate CSRF token
  const csrfToken = formData.get('csrf-token') as string
  if (!csrfToken) {
    redirect('/signup?error=' + encodeURIComponent('Security validation failed. Please try again.'))
    return
  }

  // Extract form data
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    userType: formData.get('userType') as string,
  }

  // Validate the data
  const validation = signupSchema.safeParse(rawData)

  if (!validation.success) {
    // Collect all validation errors
    const errors = validation.error.errors.map(err => err.message)
    const errorMessage = errors.join('. ')
    redirect('/signup?error=' + encodeURIComponent(errorMessage))
    return
  }

  const { email, password, firstName, lastName, userType } = validation.data

  // Use environment variable for redirect URL
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm`

  console.log('Signup redirect URL:', redirectTo) // Debug log

  // Get CAPTCHA token if provided
  const captchaToken = formData.get('captchaToken') as string | null

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        user_type: userType,
      },
      emailRedirectTo: redirectTo,
      ...(captchaToken && { captchaToken })
    },
  })

  if (error) {
    if (error.message.includes('User already registered')) {
      redirect('/signup?error=An account with this email already exists')
    }
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  redirect('/verify-email?email=' + encodeURIComponent(email))
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  // Get client IP for rate limiting
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const realIP = headersList.get('x-real-ip')
  const clientIP = forwarded?.split(',')[0] || realIP || 'unknown'

  // Check rate limiting
  const rateLimitResult = loginRateLimiter.checkLimit(clientIP, 'login')
  const currentAttempts = loginRateLimiter.getAttempts(clientIP, 'login')

  console.log(`Login attempt from IP ${clientIP}: ${currentAttempts}/10 attempts`)

  if (!rateLimitResult.allowed) {
    const retryAfterMinutes = Math.ceil((rateLimitResult.retryAfter || 0) / (1000 * 60))
    console.log(`Rate limit exceeded for IP ${clientIP}. Retry after: ${retryAfterMinutes} minutes`)
    redirect('/login?error=' + encodeURIComponent(`Too many login attempts. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}.`))
    return
  }

  // Validate CSRF token
  const csrfToken = formData.get('csrf-token') as string
  if (!csrfToken) {
    redirect('/login?error=' + encodeURIComponent('Security validation failed. Please try again.'))
    return
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const captchaToken = formData.get('captchaToken') as string | null

  const redirectPath = formData.get('redirect') as string

  // Prepare sign-in data with optional CAPTCHA token
  const signInData: {
    email: string
    password: string
    options?: { captchaToken: string }
  } = {
    email,
    password,
  }

  // Add CAPTCHA token if provided
  if (captchaToken) {
    signInData.options = { captchaToken }
  }

  const { error, data: authData } = await supabase.auth.signInWithPassword(signInData)

  if (error) {
    console.error('[Auth] Login error:', error)
    const redirectParam = redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''

    if (error.message === 'Invalid login credentials') {
      console.log('[Auth] Invalid credentials, redirecting to login')
      redirect(`/login?error=Invalid email or password${redirectParam}`)
      return
    }
    if (error.message === 'Email not confirmed') {
      console.log('[Auth] Email not confirmed, redirecting to verify-email')
      redirect('/verify-email?email=' + encodeURIComponent(data.email))
      return
    }
    console.log('[Auth] Other login error, redirecting to login with error')
    redirect(`/login?error=${encodeURIComponent(error.message)}${redirectParam}`)
    return
  }

  console.log('[Auth] Login successful for user:', authData.user.id)

  // Reset rate limit on successful login
  loginRateLimiter.reset(clientIP, 'login')
  console.log(`[Auth] Rate limit reset for IP ${clientIP} after successful login`)

  revalidatePath('/', 'layout')

  // Use redirect path if provided
  if (redirectPath) {
    console.log('[Auth] Redirecting to provided path:', redirectPath)
    redirect(redirectPath)
  }

  // Check user role for redirect
  let userRole = 'user' // default

  try {
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()

    console.log('[Auth] User role data:', userData)

    if (roleError) {
      console.error('[Auth] Role check error:', roleError)
    } else {
      userRole = userData?.role || 'user'
    }
  } catch (error) {
    console.error('[Auth] Database error during role check:', error)
  }
  
  // Redirect based on role
  if (userRole === 'admin' || userRole === 'creator' || userRole === 'reviewer') {
    console.log('[Auth] Redirecting to admin dashboard for role:', userRole)
    redirect('/admin/dashboard')
  } else {
    console.log('[Auth] Redirecting to user dashboard for role:', userRole)
    redirect('/dashboard')
  }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/callback`,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  redirect(data.url)
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  
  // Use environment variable for redirect URL
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm?type=recovery&next=/reset-password`
  
  console.log('Password reset redirect URL:', redirectTo) // Debug log

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo,
  })

  if (error) {
    redirect('/forgot-password?error=' + encodeURIComponent(error.message))
  }

  redirect('/check-email')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    redirect('/reset-password?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/password-reset-success')
}

export async function resendVerification(email: string) {
  const supabase = await createClient()

  // Use environment variable for redirect URL
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm`
  
  console.log('Resend verification redirect URL:', redirectTo) // Debug log

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: redirectTo
    }
  })

  if (error) {
    if (error.message.includes('already confirmed')) {
      redirect('/login?message=Email already verified. Please log in.')
    }
    redirect('/verify-email?error=' + encodeURIComponent(error.message))
  }

  redirect('/verify-email?message=Verification email sent')
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    redirect('/login?error=Failed to sign out')
  }

  // Clear admin-mode cookie on server side
  const cookieStore = await cookies()
  cookieStore.delete('admin-mode')

  revalidatePath('/', 'layout')
  redirect('/login')
}