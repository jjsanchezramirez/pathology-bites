#!/usr/bin/env tsx

/**
 * Fix R2 URLs in Database
 * Updates the database URLs to use the correct R2 public URL
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const WRONG_URL = 'https://pub-91b58285d6cafc1225b679e5c30d7f38.r2.dev'
const CORRECT_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'

async function fixR2URLs() {
  console.log('🔧 Fixing R2 URLs in database...')
  
  try {
    // Get all images with the wrong URL
    const { data: images, error: fetchError } = await supabase
      .from('images')
      .select('id, url')
      .like('url', `${WRONG_URL}%`)
    
    if (fetchError) {
      throw new Error(`Failed to fetch images: ${fetchError.message}`)
    }
    
    if (!images || images.length === 0) {
      console.log('✅ No URLs need fixing')
      return
    }
    
    console.log(`Found ${images.length} URLs to fix`)
    
    // Update each URL
    let fixed = 0
    for (const image of images) {
      const newUrl = image.url.replace(WRONG_URL, CORRECT_URL)
      
      const { error: updateError } = await supabase
        .from('images')
        .update({ url: newUrl })
        .eq('id', image.id)
      
      if (updateError) {
        console.error(`❌ Failed to update ${image.id}: ${updateError.message}`)
      } else {
        console.log(`✅ Fixed: ${image.id}`)
        fixed++
      }
    }
    
    console.log(`\n🎉 Fixed ${fixed}/${images.length} URLs`)
    
  } catch (error) {
    console.error(`❌ Error: ${error}`)
  }
}

if (require.main === module) {
  fixR2URLs().catch(console.error)
}
