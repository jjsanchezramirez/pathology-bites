#!/usr/bin/env tsx

/**
 * Test Single Image Upload to R2
 * Tests uploading one image to verify R2 connectivity works
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fetch from 'node-fetch'

// Load environment variables
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pathology-bites-images'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
})

async function testSingleUpload() {
  console.log('🧪 Testing Single Image Upload to R2...')
  
  try {
    // Get one image from database
    const { data: images, error } = await supabase
      .from('images')
      .select('id, url, category')
      .not('url', 'is', null)
      .limit(1)
    
    if (error || !images || images.length === 0) {
      throw new Error('No images found in database')
    }
    
    const image = images[0]
    console.log(`📸 Testing with image: ${image.url}`)
    
    // Download image
    console.log('⬇️  Downloading image...')
    const response = await fetch(image.url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    console.log(`✅ Downloaded: ${(imageBuffer.length / 1024).toFixed(1)}KB`)
    
    // Upload to R2
    console.log('⬆️  Uploading to R2...')
    const r2Key = `test/${image.id}.jpg`
    
    const command = new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        originalId: image.id,
        source: 'pathology-bites-test'
      }
    })
    
    await r2Client.send(command)
    
    const publicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${r2Key}`
    console.log(`✅ Upload successful!`)
    console.log(`🔗 Public URL: ${publicUrl}`)
    
    return true
    
  } catch (error) {
    console.error(`❌ Test failed: ${error}`)
    return false
  }
}

async function main() {
  const success = await testSingleUpload()
  if (success) {
    console.log('\n🎉 R2 upload test successful! Ready for full migration.')
  } else {
    console.log('\n❌ R2 upload test failed. Check R2 setup and credentials.')
  }
}

if (require.main === module) {
  main().catch(console.error)
}
