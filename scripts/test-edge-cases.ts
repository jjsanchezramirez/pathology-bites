/**
 * Edge case testing for UMLS expansion
 */

import { expandSearchTerm, clearExpansionCache } from '../src/app/api/public/tools/diagnostic-search/umls-expansion'

const EDGE_CASES = [
  { term: '', description: 'Empty string' },
  { term: '   ', description: 'Whitespace only' },
  { term: 'a', description: 'Single character' },
  { term: 'DLBCL!!!', description: 'Special characters' },
  { term: 'diffuse large B-cell lymphoma', description: 'Full name instead of abbreviation' },
  { term: 'XYZ123ABC', description: 'Non-existent term' },
  { term: '癌', description: 'Non-ASCII (Japanese for cancer)' },
  { term: 'DLBCL DLBCL DLBCL', description: 'Repeated terms' },
  { term: 'dlbcl', description: 'Lowercase abbreviation' },
  { term: 'DlBcL', description: 'Mixed case' },
]

async function testEdgeCases() {
  console.log('='.repeat(60))
  console.log('UMLS Edge Case Testing')
  console.log('='.repeat(60))
  console.log()

  clearExpansionCache()

  for (const { term, description } of EDGE_CASES) {
    console.log(`Test: ${description}`)
    console.log(`Input: "${term}"`)
    console.log('-'.repeat(60))

    try {
      const startTime = Date.now()
      const expansions = await expandSearchTerm(term)
      const duration = Date.now() - startTime

      console.log(`  ✓ Success (${duration}ms)`)
      console.log(`  Expansions (${expansions.length}):`)

      if (expansions.length === 0) {
        console.log(`    (none)`)
      } else if (expansions.length <= 5) {
        expansions.forEach(exp => console.log(`    - ${exp}`))
      } else {
        expansions.slice(0, 3).forEach(exp => console.log(`    - ${exp}`))
        console.log(`    ... and ${expansions.length - 3} more`)
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log()
  }

  console.log('='.repeat(60))
  console.log('Edge Case Testing Complete!')
  console.log('='.repeat(60))
}

testEdgeCases().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
