// src/lib/auth/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const userType = formData.get('userType') as string

  // Use environment variable for redirect URL
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`
  
  console.log('Signup redirect URL:', redirectTo) // Debug log

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        user_type: userType,
      },
      emailRedirectTo: redirectTo
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

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  
  const redirectPath = formData.get('redirect') as string

  const { error, data: authData } = await supabase.auth.signInWithPassword(data)

  if (error) {
    const redirectParam = redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''
    
    if (error.message === 'Invalid login credentials') {
      redirect(`/login?error=Invalid email or password${redirectParam}`)
    }
    if (error.message === 'Email not confirmed') {
      redirect('/verify-email?email=' + encodeURIComponent(data.email))
    }
    redirect(`/login?error=${encodeURIComponent(error.message)}${redirectParam}`)
  }

  revalidatePath('/', 'layout')
  
  // Use redirect path if provided
  if (redirectPath) {
    redirect(redirectPath)
  }

  // Check user role for redirect
  let userRole = 'user' // default
  
  try {
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single()
    
    console.log('User role data:', userData) // Debug log
    
    if (roleError) {
      console.error('Role check error:', roleError)
    } else {
      userRole = userData?.role || 'user'
    }
  } catch (error) {
    console.error('Database error during role check:', error)
  }
  
  // Redirect based on role
  if (userRole === 'admin') {
    console.log('Redirecting to admin dashboard') // Debug log
    redirect('/admin/dashboard')
  } else {
    console.log('Redirecting to user dashboard') // Debug log
    redirect('/dashboard')
  }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
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
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm?type=recovery&next=/reset-password`
  
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
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`
  
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

  revalidatePath('/', 'layout')
  redirect('/login')
}