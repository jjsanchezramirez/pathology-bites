// src/lib/actions/auth/reset-password.ts
'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function resetPassword(email: string) {
  const supabase = await createServerSupabase()
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=recovery`,
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function updatePassword(password: string) {
  const supabase = await createServerSupabase()
  
  const { error } = await supabase.auth.updateUser({
    password
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}