// src/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Remove the parameters - they're causing the cookie issue
export const supabase = createClientComponentClient()