/**
 * Test script for UMLS expansion service
 *
 * Tests both with and without UMLS API key to verify fallback behavior
 *
 * Usage:
 *   # Without UMLS (static only)
 *   npx tsx scripts/test-umls-expansion.ts
 *
 *   # With UMLS (requires UMLS_API_KEY in env)
 *   UMLS_API_KEY=your_key npx tsx scripts/test-umls-expansion.ts
 */

import { expandSearchTerm, getCacheStats, clearExpansionCache } from '../src/app/api/public/tools/diagnostic-search/umls-expansion'

const TEST_TERMS = [
  'DLBCL',
  'AML',
  'CLL',
  'HCC',
  'GIST',
  'melanoma',
  'lymphoma',
  'carcinoma',
  'sarcoma',
  'leukemia'
]

async function runTests() {
  console.log('='.repeat(60))
  console.log('UMLS Expansion Service Test')
  console.log('='.repeat(60))
  console.log()

  // Check if UMLS is configured
  const hasUMLSKey = !!process.env.UMLS_API_KEY
  console.log(`UMLS API Key: ${hasUMLSKey ? '✓ Configured' : '✗ Not configured (static fallback only)'}`)
  console.log()

  // Clear cache for fresh test
  clearExpansionCache()

  // Test each term
  for (const term of TEST_TERMS) {
    console.log(`Testing: "${term}"`)
    console.log('-'.repeat(60))

    const startTime = Date.now()
    const expansions = await expandSearchTerm(term)
    const duration = Date.now() - startTime

    console.log(`  Time: ${duration}ms`)
    console.log(`  Expansions (${expansions.length}):`)
    expansions.forEach((exp, idx) => {
      const marker = idx === 0 ? '→' : ' '
      console.log(`    ${marker} ${exp}`)
    })
    console.log()
  }

  // Test caching - should be instant
  console.log('Testing cache performance (re-searching first term)...')
  console.log('-'.repeat(60))

  const cachedTerm = TEST_TERMS[0]
  const cacheStartTime = Date.now()
  const cachedExpansions = await expandSearchTerm(cachedTerm)
  const cacheDuration = Date.now() - cacheStartTime

  console.log(`  Term: "${cachedTerm}"`)
  console.log(`  Time: ${cacheDuration}ms (should be <10ms)`)
  console.log(`  Expansions: ${cachedExpansions.length}`)
  console.log()

  // Show cache stats
  console.log('Cache Statistics:')
  console.log('-'.repeat(60))
  const stats = getCacheStats()
  console.log(`  Total entries: ${stats.total_entries}`)
  console.log(`  Max size: ${stats.max_size}`)
  console.log(`  TTL: ${stats.ttl_days} days`)
  console.log(`  Sources:`)
  console.log(`    - UMLS: ${stats.sources.umls}`)
  console.log(`    - Static: ${stats.sources.static}`)
  console.log(`    - Hybrid: ${stats.sources.hybrid}`)
  console.log(`  UMLS configured: ${stats.umls_configured}`)
  console.log()

  console.log('='.repeat(60))
  console.log('Test Complete!')
  console.log('='.repeat(60))
}

runTests().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
