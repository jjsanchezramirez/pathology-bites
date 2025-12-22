/**
 * Test the full diagnostic search integration with UMLS expansion
 * This simulates how the search actually works in production
 */

import { expandSearchTerm } from '../src/app/api/public/tools/diagnostic-search/umls-expansion'

// Mock index entries (simplified from actual search index)
interface IndexEntry {
  topicName: string
  lessonName: string
  normalizedTopicName: string
  normalizedLessonName: string
}

const MOCK_INDEX: IndexEntry[] = [
  {
    topicName: 'Diffuse Large B-Cell Lymphoma',
    lessonName: 'Non-Hodgkin Lymphomas',
    normalizedTopicName: 'diffuse large b cell lymphoma',
    normalizedLessonName: 'non hodgkin lymphomas'
  },
  {
    topicName: 'Acute Myeloid Leukemia',
    lessonName: 'Acute Leukemias',
    normalizedTopicName: 'acute myeloid leukemia',
    normalizedLessonName: 'acute leukemias'
  },
  {
    topicName: 'Hepatocellular Carcinoma',
    lessonName: 'Liver Tumors',
    normalizedTopicName: 'hepatocellular carcinoma',
    normalizedLessonName: 'liver tumors'
  },
  {
    topicName: 'Melanoma',
    lessonName: 'Skin Tumors',
    normalizedTopicName: 'melanoma',
    normalizedLessonName: 'skin tumors'
  },
  {
    topicName: 'Chronic Lymphocytic Leukemia',
    lessonName: 'Chronic Leukemias',
    normalizedTopicName: 'chronic lymphocytic leukemia',
    normalizedLessonName: 'chronic leukemias'
  }
]

interface SearchMatch {
  entry: IndexEntry
  matchType: 'exact' | 'starts_with' | 'contains' | 'abbreviation'
  matchScore: number
}

/**
 * Simulate the search algorithm from simple-search-v2.ts
 */
async function simulateSearch(searchTerm: string): Promise<SearchMatch[]> {
  const searchVariants = await expandSearchTerm(searchTerm)
  const matches: SearchMatch[] = []

  console.log(`  Search variants (${searchVariants.length}):`, searchVariants)

  for (const entry of MOCK_INDEX) {
    for (let i = 0; i < searchVariants.length; i++) {
      const searchNormalized = searchVariants[i]
      const isAbbreviation = i > 0

      // Exact match
      if (entry.normalizedTopicName === searchNormalized) {
        matches.push({
          entry,
          matchType: isAbbreviation ? 'abbreviation' : 'exact',
          matchScore: isAbbreviation ? 95 : 100,
        })
        break
      }

      // Starts with
      if (entry.normalizedTopicName.startsWith(searchNormalized)) {
        matches.push({
          entry,
          matchType: 'starts_with',
          matchScore: 80,
        })
        break
      }

      // Contains
      if (entry.normalizedTopicName.includes(searchNormalized)) {
        matches.push({
          entry,
          matchType: 'contains',
          matchScore: 60,
        })
        break
      }

      // Check lesson name
      if (entry.normalizedLessonName.includes(searchNormalized)) {
        matches.push({
          entry,
          matchType: 'contains',
          matchScore: 40,
        })
        break
      }
    }
  }

  matches.sort((a, b) => b.matchScore - a.matchScore)
  return matches
}

async function runSearchIntegrationTests() {
  console.log('='.repeat(60))
  console.log('Diagnostic Search Integration Test')
  console.log('='.repeat(60))
  console.log()

  console.log(`Mock index contains ${MOCK_INDEX.length} entries:`)
  MOCK_INDEX.forEach(e => console.log(`  - ${e.topicName}`))
  console.log()

  const testCases = [
    { query: 'DLBCL', expected: 'Diffuse Large B-Cell Lymphoma' },
    { query: 'dlbcl', expected: 'Diffuse Large B-Cell Lymphoma' },
    { query: 'AML', expected: 'Acute Myeloid Leukemia' },
    { query: 'HCC', expected: 'Hepatocellular Carcinoma' },
    { query: 'melanoma', expected: 'Melanoma' },
    { query: 'CLL', expected: 'Chronic Lymphocytic Leukemia' },
    { query: 'diffuse', expected: 'Diffuse Large B-Cell Lymphoma' },
    { query: 'leukemia', expected: null }, // Should find multiple
    { query: 'carcinoma', expected: 'Hepatocellular Carcinoma' },
    { query: 'XYZ999', expected: null }, // Should find nothing
  ]

  for (const { query, expected } of testCases) {
    console.log(`Query: "${query}"`)
    console.log('-'.repeat(60))

    const startTime = Date.now()
    const matches = await simulateSearch(query)
    const duration = Date.now() - startTime

    console.log(`  Time: ${duration}ms`)
    console.log(`  Matches found: ${matches.length}`)

    if (matches.length === 0) {
      console.log(`  Result: ✗ No matches`)
      if (expected !== null) {
        console.log(`  Expected: "${expected}"`)
        console.log(`  Status: ❌ FAIL`)
      } else {
        console.log(`  Status: ✓ PASS (expected no matches)`)
      }
    } else if (matches.length === 1) {
      const bestMatch = matches[0]
      console.log(`  Result: ✓ Single match`)
      console.log(`    - Topic: ${bestMatch.entry.topicName}`)
      console.log(`    - Match type: ${bestMatch.matchType}`)
      console.log(`    - Score: ${bestMatch.matchScore}`)

      if (expected && bestMatch.entry.topicName === expected) {
        console.log(`  Status: ✓ PASS`)
      } else if (expected) {
        console.log(`  Expected: "${expected}"`)
        console.log(`  Status: ❌ FAIL`)
      } else {
        console.log(`  Status: ✓ PASS`)
      }
    } else {
      console.log(`  Result: ⚠ Multiple matches`)
      matches.slice(0, 3).forEach(m => {
        console.log(`    - ${m.entry.topicName} (${m.matchType}, score: ${m.matchScore})`)
      })
      if (matches.length > 3) {
        console.log(`    ... and ${matches.length - 3} more`)
      }
      console.log(`  Status: ✓ PASS (disambiguation needed)`)
    }

    console.log()
  }

  console.log('='.repeat(60))
  console.log('Integration Test Complete!')
  console.log('='.repeat(60))
}

runSearchIntegrationTests().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
