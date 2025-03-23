// src/lib/actions/auth/verify-email.ts
'use server'

import { createServerSupabase } from '@/lib/supabase/server'

export async function resendVerification(email: string) {
  const supabase = await createServerSupabase()
  
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup_confirmation&next=/email-verified`
    }
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}