#!/usr/bin/env tsx

/**
 * Simple R2 Connection Test
 * Tests basic connectivity to Cloudflare R2 before running the full migration
 */

import { config } from 'dotenv'
import { S3Client, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

// Load environment variables
config({ path: '.env.local' })

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pathology-bites-images'

console.log('🔧 Testing Cloudflare R2 Connection...')
console.log(`Account ID: ${CLOUDFLARE_ACCOUNT_ID}`)
console.log(`Access Key ID: ${CLOUDFLARE_R2_ACCESS_KEY_ID}`)
console.log(`Secret Key: ${CLOUDFLARE_R2_SECRET_ACCESS_KEY ? '***' + CLOUDFLARE_R2_SECRET_ACCESS_KEY.slice(-4) : 'NOT SET'}`)
console.log(`Bucket Name: ${CLOUDFLARE_R2_BUCKET_NAME}`)

// Validate credentials
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing required R2 credentials!')
  process.exit(1)
}

// Try different R2 client configurations
const configs = [
  {
    name: 'Standard Config',
    config: {
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    }
  },
  {
    name: 'With Force Path Style',
    config: {
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    }
  }
]

async function testConnection(configName: string, clientConfig: any) {
  console.log(`\n🧪 Testing: ${configName}`)
  
  try {
    const client = new S3Client(clientConfig)
    
    // Test 1: List buckets
    console.log('  📋 Testing ListBuckets...')
    const listCommand = new ListBucketsCommand({})
    const listResult = await client.send(listCommand)
    console.log(`  ✅ ListBuckets successful: Found ${listResult.Buckets?.length || 0} buckets`)
    
    // Test 2: Check if our bucket exists
    console.log(`  🪣 Testing HeadBucket for '${CLOUDFLARE_R2_BUCKET_NAME}'...`)
    try {
      const headCommand = new HeadBucketCommand({ Bucket: CLOUDFLARE_R2_BUCKET_NAME })
      await client.send(headCommand)
      console.log(`  ✅ Bucket '${CLOUDFLARE_R2_BUCKET_NAME}' exists and is accessible`)
    } catch (headError: any) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        console.log(`  ⚠️  Bucket '${CLOUDFLARE_R2_BUCKET_NAME}' does not exist`)
        
        // Test 3: Try to create bucket
        console.log(`  🔨 Attempting to create bucket...`)
        try {
          const createCommand = new CreateBucketCommand({ Bucket: CLOUDFLARE_R2_BUCKET_NAME })
          await client.send(createCommand)
          console.log(`  ✅ Bucket '${CLOUDFLARE_R2_BUCKET_NAME}' created successfully`)
        } catch (createError) {
          console.log(`  ❌ Failed to create bucket: ${createError}`)
        }
      } else {
        console.log(`  ❌ HeadBucket failed: ${headError}`)
      }
    }
    
    return true
  } catch (error) {
    console.log(`  ❌ Connection failed: ${error}`)
    return false
  }
}

async function main() {
  for (const { name, config } of configs) {
    const success = await testConnection(name, config)
    if (success) {
      console.log(`\n🎉 Success with: ${name}`)
      break
    }
  }
}

if (require.main === module) {
  main().catch(console.error)
}
