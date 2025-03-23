// src/lib/actions/auth/signup.ts
'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignupFormData } from '@/types/auth'

export async function signup(formData: Omit<SignupFormData, 'confirmPassword'>) {
  const supabase = await createServerSupabase()
  
  // First check if email exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('email')
    .eq('email', formData.email)
    .single()
    
  if (existingUser) {
    return { 
      success: false, 
      error: 'This email address is already registered. Please sign in instead.' 
    }
  }
  
  // Proceed with signup
  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        first_name: formData.firstName,
        last_name: formData.lastName,
        user_type: formData.userType,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup_confirmation&next=/email-verified`
    },
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}