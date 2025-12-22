/**
 * NCI EVS Debugging Tool
 *
 * Test NCI EVS API searches directly to see what results we get
 */

const testTerms = [
  'PTGC',
  'ptgc',
  'papillary thyroid',
  'FADLBCL',
  'fadlbcl',
  'fibrin associated',
  'DLBCL',
  'melanoma',
  'AML',
  'CLL',
]

async function searchNCIEVS(term: string) {
  try {
    const searchUrl = new URL('https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search')
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('limit', '10')
    searchUrl.searchParams.set('include', 'summary') // Get more details

    console.log(`\nSearching NCI EVS for: "${term}"`)
    console.log(`URL: ${searchUrl.toString()}`)
    console.log('-'.repeat(70))

    const response = await fetch(searchUrl.toString(), {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      console.log(`❌ Error: ${response.status} ${response.statusText}`)
      return
    }

    const data = await response.json()
    const results = data?.concepts || []

    console.log(`Found ${results.length} results:`)

    if (results.length === 0) {
      console.log('  (no results)')
    } else {
      results.forEach((result: any, idx: number) => {
        console.log(`\n  ${idx + 1}. ${result.name}`)
        console.log(`     Code: ${result.code}`)
        if (result.synonyms && result.synonyms.length > 0) {
          console.log(`     Synonyms: ${result.synonyms.slice(0, 3).map((s: any) => s.name).join(', ')}`)
        }
      })
    }

  } catch (error) {
    console.log(`❌ Exception: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('NCI EVS API DEBUGGING TOOL')
  console.log('='.repeat(70))

  for (const term of testTerms) {
    await searchNCIEVS(term)
    await new Promise(resolve => setTimeout(resolve, 200)) // Rate limit
  }

  console.log('\n' + '='.repeat(70))
  console.log('Testing with different search parameters...')
  console.log('='.repeat(70))

  // Try with fromRecord parameter
  const testUrl = new URL('https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search')
  testUrl.searchParams.set('term', 'PTGC')
  testUrl.searchParams.set('limit', '20')
  testUrl.searchParams.set('fromRecord', '0')

  console.log(`\nTrying with fromRecord parameter for PTGC:`)
  console.log(`URL: ${testUrl.toString()}`)

  const response = await fetch(testUrl.toString(), {
    headers: { 'Accept': 'application/json' }
  })

  const data = await response.json()
  console.log(`Results: ${data?.concepts?.length || 0}`)

  if (data?.concepts && data.concepts.length > 0) {
    data.concepts.forEach((c: any) => {
      console.log(`  - ${c.name} (${c.code})`)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('DEBUGGING COMPLETE')
  console.log('='.repeat(70))
}

main().catch(console.error)
