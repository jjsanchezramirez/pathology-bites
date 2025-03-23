// src/lib/actions/auth/login.ts
'use server'

import { createServerSupabase } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string) {
  const supabase = await createServerSupabase()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  // Check user role for redirection
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()
    
  if (userError) {
    return { success: true, redirectUrl: '/dashboard' }
  }
  
  return { 
    success: true, 
    redirectUrl: userData?.role === 'admin' ? '/admin' : '/dashboard'
  }
}

export async function loginWithGoogle() {
  const supabase = await createServerSupabase()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true, url: data.url }
}