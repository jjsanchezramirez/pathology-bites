#!/usr/bin/env tsx

/**
 * Fix ABPath CORS by re-uploading the content-specs.json file with proper headers
 * This script downloads the current file and re-uploads it with CORS-friendly headers
 */

import { uploadToR2, getFileContent } from '../src/shared/services/r2-storage'

const DATA_BUCKET = 'pathology-bites-data'
const ABPATH_KEY = 'ab-path/content-specs.json'

async function fixABPathCORS() {
  console.log('🔧 Fixing ABPath CORS by re-uploading content-specs.json with proper headers...')
  
  try {
    // Step 1: Download current file
    console.log('📥 Downloading current content-specs.json from R2...')
    const currentContent = await getFileContent(DATA_BUCKET, ABPATH_KEY)
    
    if (!currentContent) {
      throw new Error('Failed to download current content-specs.json from R2')
    }
    
    console.log(`✅ Downloaded ${currentContent.length} bytes`)
    
    // Step 2: Validate it's valid JSON
    let jsonData
    try {
      jsonData = JSON.parse(currentContent.toString())
      console.log(`✅ Validated JSON structure (${Object.keys(jsonData).length} top-level keys)`)
    } catch (e) {
      throw new Error('Current file is not valid JSON')
    }
    
    // Step 3: Re-upload with proper headers for CORS
    console.log('📤 Re-uploading with CORS-friendly headers...')
    const uploadResult = await uploadToR2(
      Buffer.from(JSON.stringify(jsonData, null, 2)), // Pretty-print JSON
      ABPATH_KEY,
      {
        contentType: 'application/json',
        cacheControl: 'public, max-age=3600, must-revalidate', // CORS-friendly cache control
        bucket: DATA_BUCKET,
        metadata: {
          source: 'cors-fix-script',
          uploadedAt: new Date().toISOString(),
          corsEnabled: 'true'
        }
      }
    )
    
    console.log('✅ Successfully re-uploaded content-specs.json!')
    console.log(`📍 URL: ${uploadResult.url}`)
    console.log(`📊 Size: ${uploadResult.size} bytes`)
    console.log(`🏷️  Content-Type: ${uploadResult.contentType}`)
    
    // Step 4: Test direct access
    console.log('\n🧪 Testing direct CORS access...')
    const testUrl = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/ab-path/content-specs.json'
    
    try {
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://pathologybites.com' // Test with actual domain
        }
      })
      
      console.log(`📡 Test fetch status: ${testResponse.status}`)
      console.log(`🔍 CORS headers:`)
      console.log(`   Access-Control-Allow-Origin: ${testResponse.headers.get('access-control-allow-origin')}`)
      console.log(`   Access-Control-Allow-Methods: ${testResponse.headers.get('access-control-allow-methods')}`)
      console.log(`   Content-Type: ${testResponse.headers.get('content-type')}`)
      
      if (testResponse.ok) {
        const testData = await testResponse.json()
        console.log(`✅ Direct access successful! Data has ${testData.content_specifications?.ap_sections?.length || 0} AP sections`)
      } else {
        console.log(`❌ Direct access failed: ${testResponse.statusText}`)
      }
      
    } catch (testError) {
      console.log(`❌ Direct access test failed: ${testError}`)
    }
    
    console.log('\n🎉 ABPath CORS fix completed!')
    console.log('💡 You can now update the hook to use direct R2 access')
    
  } catch (error) {
    console.error('❌ Failed to fix ABPath CORS:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  fixABPathCORS()
}
