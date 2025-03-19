// src/lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export async function createServerSupabase() {
  // This approach ensures cookies() is called directly without being passed as a function
  const cookieStore = cookies()
  
  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  })
}