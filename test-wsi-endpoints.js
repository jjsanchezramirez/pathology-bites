// Test script for the new WSI Question Generator endpoints
const BASE_URL = 'http://localhost:3001'

// Sample WSI data for testing
const testWSI = {
  id: 'test-1',
  diagnosis: 'Adenocarcinoma',
  organ: 'Colon',
  stain: 'H&E',
  magnification: '400x',
  image_url: 'https://example.com/test-image.jpg'
}

async function testPrepareEndpoint() {
  console.log('\n🧪 Testing /api/tools/wsi-question-generator/prepare')
  
  try {
    const response = await fetch(`${BASE_URL}/api/tools/wsi-question-generator/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wsi: testWSI,
        context: null
      })
    })

    const data = await response.json()
    
    if (response.ok && data.success) {
      console.log('✅ Prepare endpoint working')
      console.log(`   - Preparation time: ${data.metadata.preparation_time_ms}ms`)
      console.log(`   - Prompt length: ${data.metadata.prompt_length} characters`)
      return data
    } else {
      console.log('❌ Prepare endpoint failed:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ Prepare endpoint error:', error.message)
    return null
  }
}

async function testAIGenerateEndpoint(prompt) {
  console.log('\n🧪 Testing /api/tools/wsi-question-generator/ai-generate')
  
  try {
    const response = await fetch(`${BASE_URL}/api/tools/wsi-question-generator/ai-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        modelIndex: 0
      })
    })

    const data = await response.json()
    
    if (response.ok && data.success) {
      console.log('✅ AI Generate endpoint working')
      console.log(`   - Generation time: ${data.metadata.generation_time_ms}ms`)
      console.log(`   - Model used: ${data.metadata.model}`)
      console.log(`   - Response length: ${data.metadata.response_length} characters`)
      return data
    } else {
      console.log('❌ AI Generate endpoint failed:', data.error)
      if (data.nextModelIndex !== null) {
        console.log(`   - Next model available: ${data.nextModel}`)
      }
      return null
    }
  } catch (error) {
    console.log('❌ AI Generate endpoint error:', error.message)
    return null
  }
}

async function testParseEndpoint(content, wsi, metadata) {
  console.log('\n🧪 Testing /api/tools/wsi-question-generator/parse')
  
  try {
    const response = await fetch(`${BASE_URL}/api/tools/wsi-question-generator/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content,
        wsi: wsi,
        metadata: metadata
      })
    })

    const data = await response.json()
    
    if (response.ok && data.success) {
      console.log('✅ Parse endpoint working')
      console.log(`   - Parsing time: ${data.metadata.parsing_time_ms}ms`)
      console.log(`   - Question stem: ${data.question.stem.substring(0, 100)}...`)
      console.log(`   - Number of options: ${data.question.options.length}`)
      return data
    } else {
      console.log('❌ Parse endpoint failed:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ Parse endpoint error:', error.message)
    return null
  }
}

async function runFullTest() {
  console.log('🚀 Starting WSI Question Generator endpoint tests...')
  
  // Test 1: Prepare endpoint
  const prepareResult = await testPrepareEndpoint()
  if (!prepareResult) {
    console.log('\n❌ Test failed at prepare step')
    return
  }

  // Test 2: AI Generate endpoint
  const aiResult = await testAIGenerateEndpoint(prepareResult.prompt)
  if (!aiResult) {
    console.log('\n❌ Test failed at AI generation step')
    return
  }

  // Test 3: Parse endpoint
  const parseResult = await testParseEndpoint(
    aiResult.content, 
    prepareResult.wsi, 
    { ...prepareResult.metadata, ...aiResult.metadata }
  )
  if (!parseResult) {
    console.log('\n❌ Test failed at parsing step')
    return
  }

  console.log('\n🎉 All tests passed! The new multi-step approach is working.')
  console.log('\n📊 Summary:')
  console.log(`   - Total time: ${prepareResult.metadata.preparation_time_ms + aiResult.metadata.generation_time_ms + parseResult.metadata.parsing_time_ms}ms`)
  console.log(`   - Prepare: ${prepareResult.metadata.preparation_time_ms}ms`)
  console.log(`   - AI Generate: ${aiResult.metadata.generation_time_ms}ms`)
  console.log(`   - Parse: ${parseResult.metadata.parsing_time_ms}ms`)
}

// Run the test if this script is executed directly
if (typeof window === 'undefined') {
  runFullTest().catch(console.error)
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.testWSIEndpoints = runFullTest
}
