// src/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient({
  cookieOptions: {
    name: 'sb-auth', // Custom cookie name
    lifetime: 60 * 60 * 8, // 8 hours
    domain: process.env.NODE_ENV === 'production' 
      ? process.env.COOKIE_DOMAIN 
      : 'localhost',
    path: '/',
    sameSite: 'lax'
  }
})