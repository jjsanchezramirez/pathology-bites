#!/usr/bin/env tsx
/**
 * Test R2 Connection Script
 *
 * Tests the Cloudflare R2 connection and credentials to diagnose issues
 */

import { config } from 'dotenv'
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Load environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME

console.log('🔍 Testing Cloudflare R2 Connection...\n')

// Check environment variables
console.log('📋 Environment Variables:')
console.log(`CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID ? '✅ Set' : '❌ Missing'}`)
console.log(`CLOUDFLARE_R2_ACCESS_KEY_ID: ${CLOUDFLARE_R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`)
console.log(`CLOUDFLARE_R2_SECRET_ACCESS_KEY: ${CLOUDFLARE_R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`)
console.log(`CLOUDFLARE_R2_BUCKET_NAME: ${CLOUDFLARE_R2_BUCKET_NAME ? '✅ Set' : '❌ Missing'}`)

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET_NAME) {
  console.log('\n❌ Missing required environment variables. Please check your .env.local file.')
  process.exit(1)
}

// Configure R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
})

async function testR2Connection() {
  try {
    console.log('\n🔗 Testing R2 connection...')
    
    // Test 1: List objects in bucket
    console.log('1. Testing bucket access...')
    const listCommand = new ListObjectsV2Command({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      MaxKeys: 5
    })
    
    const listResult = await r2Client.send(listCommand)
    console.log(`   ✅ Bucket access successful. Found ${listResult.KeyCount || 0} objects.`)
    
    // Test 2: Upload a small test file
    console.log('2. Testing file upload...')
    const testContent = Buffer.from('Test file for R2 connection', 'utf-8')
    const testKey = `test/connection-test-${Date.now()}.txt`
    
    const uploadCommand = new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      Metadata: {
        'test': 'true',
        'timestamp': new Date().toISOString()
      }
    })
    
    await r2Client.send(uploadCommand)
    console.log(`   ✅ File upload successful. Test file: ${testKey}`)
    
    console.log('\n🎉 R2 connection test passed! All credentials are working correctly.')
    
    return true
  } catch (error) {
    console.log('\n❌ R2 connection test failed:')
    console.error(error)
    
    if (error instanceof Error) {
      if (error.message.includes('credential')) {
        console.log('\n💡 This appears to be a credential issue. Please verify:')
        console.log('   - Your Cloudflare R2 API tokens are correct')
        console.log('   - The tokens have the necessary permissions')
        console.log('   - The account ID matches your Cloudflare account')
      } else if (error.message.includes('bucket')) {
        console.log('\n💡 This appears to be a bucket issue. Please verify:')
        console.log('   - The bucket name is correct')
        console.log('   - The bucket exists in your R2 account')
        console.log('   - You have access to the bucket')
      }
    }
    
    return false
  }
}

// Run the test
if (require.main === module) {
  testR2Connection()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Test failed with error:', error)
      process.exit(1)
    })
}

export { testR2Connection }
