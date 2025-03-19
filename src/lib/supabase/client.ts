// src/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

// Create a type-safe client with the Database type
export const supabase = createClientComponentClient<Database>()