#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkURLs() {
  const { data } = await supabase
    .from('images')
    .select('url')
    .limit(3)
  
  console.log('Sample URLs:')
  data?.forEach((img, i) => {
    console.log(`${i + 1}. ${img.url}`)
  })
}

checkURLs().catch(console.error)
