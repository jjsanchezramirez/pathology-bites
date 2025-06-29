// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { validateClientEnv } from '@/shared/utils/env-validation'

export function createClient() {
  const config = validateClientEnv()

  return createBrowserClient(
    config.url,
    config.anonKey
  )
}