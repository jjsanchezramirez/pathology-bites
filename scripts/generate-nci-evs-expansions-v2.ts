#!/usr/bin/env tsx

/**
 * Generate NCI EVS Expansions v2 - Neoplasm-Focused with Relevance Scores
 *
 * Improvements:
 * 1. Filter to neoplasm-related terms only using NCI EVS semantic types
 * 2. Include relevance scores from NCI EVS API
 * 3. Sort expansions by score (highest first)
 * 4. Smarter abbreviation extraction from virtual slides dataset
 */

import { readFileSync } from 'fs'
import { writeFileSync } from 'fs'

// NCI EVS API configuration
const NCI_EVS_BASE = 'https://api-evsrest.nci.nih.gov/api/v1'
const RATE_LIMIT_DELAY = 250 // ms between API calls

// Pathology/Neoplasm-relevant semantic types (high priority)
const NEOPLASM_SEMANTIC_TYPES = new Set([
  'Neoplastic Process',
  'Disease or Syndrome',
  'Pathologic Function',
  'Anatomical Abnormality',
  'Finding'
])

interface NCIConcept {
  code: string
  name: string
  score?: number // Relevance score from API
  synonyms?: Array<{
    name: string
    type?: string
    termType?: string
  }>
  semanticTypes?: string[]
  properties?: Array<{
    type: string
    value: string
  }>
}

interface ScoredExpansion {
  term: string
  score: number
  semantic_types: string[]
}

interface ExpansionEntry {
  expansions: ScoredExpansion[]
  source: 'nci_evs'
  generated_at: string
  filter: 'neoplasm'
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract semantic types from concept properties
 */
function getSemanticTypes(concept: NCIConcept): string[] {
  if (!concept.properties) return []

  return concept.properties
    .filter(prop => prop.type === 'Semantic_Type')
    .map(prop => prop.value)
}

/**
 * Check if concept is neoplasm-related
 */
function isNeoplasm(concept: NCIConcept): boolean {
  const semanticTypes = getSemanticTypes(concept)
  return semanticTypes.some(type => NEOPLASM_SEMANTIC_TYPES.has(type))
}

/**
 * Calculate relevance score for a concept
 */
function calculateRelevanceScore(concept: NCIConcept, searchTerm: string): number {
  let score = concept.score || 0 // Start with API's score if available

  const searchLower = searchTerm.toLowerCase()
  const nameLower = concept.name.toLowerCase()

  // Exact match bonus
  if (nameLower === searchLower) {
    score += 1000
  }

  // Starts with bonus
  if (nameLower.startsWith(searchLower)) {
    score += 500
  }

  // Semantic type priority
  const semanticTypes = getSemanticTypes(concept)
  if (semanticTypes.includes('Neoplastic Process')) {
    score += 500
  }
  if (semanticTypes.includes('Disease or Syndrome')) {
    score += 400
  }

  // Has definition bonus
  if (concept.properties?.some(p => p.type === 'DEFINITION')) {
    score += 100
  }

  return score
}

/**
 * Fetch NCI EVS expansions with semantic filtering
 */
async function fetchNCIEVS(term: string): Promise<ScoredExpansion[]> {
  try {
    const searchUrl = new URL(`${NCI_EVS_BASE}/concept/ncit/search`)
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('include', 'synonyms,properties')
    searchUrl.searchParams.set('pageSize', '20') // Fetch more to filter

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`  ⚠️  API error ${response.status} for "${term}"`)
      return []
    }

    const data = await response.json()
    const concepts: NCIConcept[] = data?.concepts || []

    if (concepts.length === 0) {
      return []
    }

    // Filter to neoplasm-related concepts only
    const neoplasms = concepts.filter(isNeoplasm)

    if (neoplasms.length === 0) {
      return []
    }

    // Collect all unique expansions with scores
    const expansionMap = new Map<string, ScoredExpansion>()

    for (const concept of neoplasms.slice(0, 10)) {
      const score = calculateRelevanceScore(concept, term)
      const semanticTypes = getSemanticTypes(concept)

      // Add the main name
      const normalizedName = normalize(concept.name)
      if (normalizedName !== normalize(term)) {
        const existing = expansionMap.get(normalizedName)
        if (!existing || score > existing.score) {
          expansionMap.set(normalizedName, {
            term: normalizedName,
            score,
            semantic_types: semanticTypes
          })
        }
      }

      // Add synonyms
      if (concept.synonyms) {
        for (const syn of concept.synonyms) {
          const normalizedSyn = normalize(syn.name)
          if (normalizedSyn !== normalize(term)) {
            const existing = expansionMap.get(normalizedSyn)
            const synScore = score - 100 // Synonyms get slightly lower score

            if (!existing || synScore > existing.score) {
              expansionMap.set(normalizedSyn, {
                term: normalizedSyn,
                score: synScore,
                semantic_types: semanticTypes
              })
            }
          }
        }
      }
    }

    // Sort by score (highest first) and return top 10
    const sorted = Array.from(expansionMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return sorted

  } catch (error) {
    console.warn(`  ⚠️  Failed to fetch "${term}":`, error instanceof Error ? error.message : 'Unknown')
    return []
  }
}

/**
 * Smarter abbreviation extraction from virtual slides
 */
async function extractAbbreviationsFromDataset(): Promise<Map<string, number>> {
  const VIRTUAL_SLIDES_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'

  console.log('📊 Analyzing virtual slides dataset...\n')

  const response = await fetch(VIRTUAL_SLIDES_URL)
  const slides = await response.json()

  console.log(`✓ Loaded ${slides.length.toLocaleString()} slides\n`)

  const abbrevCounts = new Map<string, number>()

  // Known pathology-related abbreviations pattern
  const pathologyAbbrevs = new Set([
    // Common neoplasms (will be in dataset)
    'SCC', 'BCC', 'RCC', 'HCC', 'TCC', 'DCIS', 'LCIS', 'IDC', 'ILC',
    'DLBCL', 'FL', 'HL', 'NHL', 'CLL', 'AML', 'ALL', 'CML', 'MM',
    'GIST', 'PNET', 'MPNST', 'GBM', 'NSCLC', 'SCLC', 'PDAC',
    // Pathology-specific terms
    'AITL', 'ALCL', 'PTCL', 'MCL', 'MZL', 'MALT', 'SLL',
    'PIN', 'CIN', 'VIN', 'VAIN', 'AIS', 'HSIL', 'LSIL',
    'ADH', 'ALH', 'FEA', 'PASH', 'NET', 'NUT', 'GIST'
  ])

  for (const slide of slides) {
    if (!slide.diagnosis) continue

    // Extract 2-5 letter uppercase words
    const matches = slide.diagnosis.match(/\b[A-Z]{2,5}\b/g)
    if (!matches) continue

    for (const match of matches) {
      // Skip grade numbers and other non-pathology terms
      if (/^(WHO|IV|III|II|I|NOS|VS|FOR|AND|THE|WITH)$/.test(match)) continue

      // Only count if it's a known pathology abbreviation OR appears frequently
      if (pathologyAbbrevs.has(match)) {
        abbrevCounts.set(match.toLowerCase(), (abbrevCounts.get(match.toLowerCase()) || 0) + 1)
      }
    }
  }

  return abbrevCounts
}

async function main() {
  console.log('🔬 Generating NCI EVS Expansions v2 - Neoplasm-Focused\n')
  console.log('Features:')
  console.log('  ✓ Neoplasm-related terms only')
  console.log('  ✓ Relevance scores included')
  console.log('  ✓ Sorted by score (highest first)')
  console.log('  ✓ Smarter abbreviation detection\n')

  // Extract abbreviations from dataset
  const abbrevCounts = await extractAbbreviationsFromDataset()

  // Sort by frequency
  const sortedAbbrevs = Array.from(abbrevCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100) // Top 100 most frequent

  console.log(`Found ${sortedAbbrevs.length} pathology abbreviations in dataset\n`)
  console.log('Top 20:')
  sortedAbbrevs.slice(0, 20).forEach(([abbrev, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${abbrev.toUpperCase().padEnd(8)} - ${count} occurrences`)
  })
  console.log('')

  const terms = sortedAbbrevs.map(([abbrev]) => abbrev)

  console.log(`\nProcessing ${terms.length} terms...\n`)
  console.log(`Rate limit: ${RATE_LIMIT_DELAY}ms between requests`)
  console.log(`Estimated time: ~${Math.ceil(terms.length * RATE_LIMIT_DELAY / 1000)}s\n`)

  const expansionMap: Record<string, ExpansionEntry> = {}
  let processed = 0
  let successful = 0

  for (const term of terms) {
    processed++

    process.stdout.write(`[${processed.toString().padStart(3)}/${terms.length}] ${term.toUpperCase().padEnd(10)} ... `)

    const expansions = await fetchNCIEVS(term)

    if (expansions.length > 0) {
      expansionMap[term] = {
        expansions,
        source: 'nci_evs',
        generated_at: new Date().toISOString(),
        filter: 'neoplasm'
      }
      console.log(`✓ ${expansions.length} neoplasm expansions (top score: ${expansions[0].score})`)
      successful++
    } else {
      console.log(`✗ No neoplasm matches`)
    }

    if (processed < terms.length) {
      await sleep(RATE_LIMIT_DELAY)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`Total processed:  ${processed}`)
  console.log(`Successful:       ${successful} (${Math.round(successful / processed * 100)}%)`)
  console.log(`Total expansions: ${Object.keys(expansionMap).length}`)

  // Save
  const outputPath = 'public/nci-evs-expansions.json'
  writeFileSync(outputPath, JSON.stringify(expansionMap, null, 2))

  const stats = readFileSync(outputPath)
  console.log(`\n✅ Saved to: ${outputPath}`)
  console.log(`📦 File size: ${(stats.length / 1024).toFixed(2)} KB`)

  // Show examples
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 SAMPLE EXPANSIONS (with scores)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const samples = ['dlbcl', 'scc', 'hcc', 'aitl', 'dcis']
  for (const term of samples) {
    if (expansionMap[term]) {
      console.log(`${term.toUpperCase()}:`)
      expansionMap[term].expansions.slice(0, 5).forEach((exp, i) => {
        console.log(`  ${i + 1}. ${exp.term}`)
        console.log(`     Score: ${exp.score}`)
      })
      console.log('')
    }
  }
}

main()
