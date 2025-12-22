#!/usr/bin/env tsx

/**
 * Generate NCI EVS Expansions v3 - Comprehensive Dataset-Driven Approach
 *
 * Strategy:
 * 1. Extract ALL medical terms from virtual slides (both full names and abbreviations)
 * 2. Use the most frequently occurring terms from the actual dataset
 * 3. For each term, fetch NCI EVS expansions with neoplasm filtering
 * 4. This ensures we cover real-world usage patterns
 */

import { readFileSync, writeFileSync } from 'fs'

interface VirtualSlide {
  diagnosis: string
  [key: string]: any
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

const VIRTUAL_SLIDES_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'
const NCI_EVS_BASE = 'https://api-evsrest.nci.nih.gov/api/v1'
const RATE_LIMIT_DELAY = 250 // ms between API calls

// Neoplasm-relevant semantic types
const NEOPLASM_SEMANTIC_TYPES = new Set([
  'Neoplastic Process',
  'Disease or Syndrome',
  'Pathologic Function',
  'Anatomical Abnormality',
  'Finding'
])

// Common medical stop words to ignore
const STOP_WORDS = new Set([
  'with', 'without', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'from',
  'the', 'a', 'an', 'as', 'by', 'is', 'was', 'are', 'were', 'been', 'being',
  'nos', 'not', 'otherwise', 'specified', 'type', 'grade', 'stage', 'level'
])

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

function getSemanticTypes(concept: any): string[] {
  if (!concept.properties) return []
  return concept.properties
    .filter((prop: any) => prop.type === 'Semantic_Type')
    .map((prop: any) => prop.value)
}

function isNeoplasm(concept: any): boolean {
  const semanticTypes = getSemanticTypes(concept)
  return semanticTypes.some(type => NEOPLASM_SEMANTIC_TYPES.has(type))
}

function calculateRelevanceScore(concept: any, searchTerm: string): number {
  let score = concept.score || 0

  const searchLower = searchTerm.toLowerCase()
  const nameLower = concept.name.toLowerCase()

  // Exact match bonus
  if (nameLower === searchLower) score += 1000

  // Starts with bonus
  if (nameLower.startsWith(searchLower)) score += 500

  // Semantic type priority
  const semanticTypes = getSemanticTypes(concept)
  if (semanticTypes.includes('Neoplastic Process')) score += 500
  if (semanticTypes.includes('Disease or Syndrome')) score += 400

  // Has definition bonus
  if (concept.properties?.some((p: any) => p.type === 'DEFINITION')) score += 100

  return score
}

async function fetchNCIEVS(term: string): Promise<ScoredExpansion[]> {
  try {
    const searchUrl = new URL(`${NCI_EVS_BASE}/concept/ncit/search`)
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('include', 'synonyms,properties')
    searchUrl.searchParams.set('pageSize', '20')

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
    const concepts = data?.concepts || []

    if (concepts.length === 0) return []

    // Filter to neoplasm-related concepts only
    const neoplasms = concepts.filter(isNeoplasm)

    if (neoplasms.length === 0) return []

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
            const synScore = score - 100

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
 * Extract ALL potential search terms from virtual slides
 * Including both abbreviations and full medical terms
 */
function extractSearchTerms(slides: VirtualSlide[]): Map<string, number> {
  const termCounts = new Map<string, number>()

  for (const slide of slides) {
    if (!slide.diagnosis) continue

    const diagnosis = slide.diagnosis

    // Pattern 1: Explicit abbreviations (2-5 uppercase letters)
    const abbrevMatches = diagnosis.match(/\b[A-Z]{2,5}\b/g)
    if (abbrevMatches) {
      for (const abbrev of abbrevMatches) {
        // Skip common non-medical abbreviations
        if (!/^(WHO|IV|III|II|I|NOS|VS|FOR|AND|THE|WITH|TNM|AJCC|FIGO)$/.test(abbrev)) {
          const normalized = abbrev.toLowerCase()
          termCounts.set(normalized, (termCounts.get(normalized) || 0) + 1)
        }
      }
    }

    // Pattern 2: Common neoplasm terms (from normalized text)
    const normalized = normalize(diagnosis)
    const neoplasmPatterns = [
      /\b([\w\s]{5,50}carcinoma)\b/g,
      /\b([\w\s]{5,50}sarcoma)\b/g,
      /\b([\w\s]{5,50}lymphoma)\b/g,
      /\b([\w\s]{5,50}leukemia)\b/g,
      /\b([\w\s]{5,50}melanoma)\b/g,
      /\b([\w\s]{5,50}blastoma)\b/g,
      /\b([\w\s]{5,50}adenoma)\b/g,
      /\b([\w\s]{5,50}glioma)\b/g,
    ]

    for (const pattern of neoplasmPatterns) {
      const matches = normalized.match(pattern)
      if (matches) {
        for (const match of matches) {
          const cleaned = match.trim()
          const words = cleaned.split(/\s+/)

          // Only keep if 2-5 words and doesn't start with stop word
          if (words.length >= 2 && words.length <= 5 && !STOP_WORDS.has(words[0])) {
            termCounts.set(cleaned, (termCounts.get(cleaned) || 0) + 1)
          }
        }
      }
    }
  }

  return termCounts
}

async function main() {
  console.log('🔬 Generating NCI EVS Expansions v3 - Dataset-Driven\n')
  console.log('Features:')
  console.log('  ✓ Extracts terms from actual virtual slides dataset')
  console.log('  ✓ Includes both abbreviations AND full medical terms')
  console.log('  ✓ Neoplasm-filtered with relevance scores')
  console.log('  ✓ Covers real-world search patterns\n')

  console.log('📊 Loading virtual slides dataset...\n')

  const response = await fetch(VIRTUAL_SLIDES_URL)
  const slides: VirtualSlide[] = await response.json()

  console.log(`✓ Loaded ${slides.length.toLocaleString()} slides\n`)
  console.log('Extracting search terms from diagnoses...\n')

  const termCounts = extractSearchTerms(slides)

  // Sort by frequency and take top terms
  const sortedTerms = Array.from(termCounts.entries())
    .sort((a, b) => b[1] - a[1])

  console.log(`Found ${sortedTerms.length.toLocaleString()} unique search terms\n`)

  // Show top 30
  console.log('Top 30 most frequent terms:')
  sortedTerms.slice(0, 30).forEach(([term, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${term.padEnd(40)} - ${count} occurrences`)
  })
  console.log('')

  // Take top 150 for pre-computation (balance between coverage and file size)
  const termsToProcess = sortedTerms.slice(0, 150).map(([term]) => term)

  console.log(`\nProcessing top ${termsToProcess.length} terms for NCI EVS expansion...\n`)
  console.log(`Rate limit: ${RATE_LIMIT_DELAY}ms between requests`)
  console.log(`Estimated time: ~${Math.ceil(termsToProcess.length * RATE_LIMIT_DELAY / 1000)}s\n`)

  const expansionMap: Record<string, ExpansionEntry> = {}
  let processed = 0
  let successful = 0

  for (const term of termsToProcess) {
    processed++

    process.stdout.write(`[${processed.toString().padStart(3)}/${termsToProcess.length}] ${term.toUpperCase().padEnd(20)} ... `)

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

    if (processed < termsToProcess.length) {
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

  // Show examples including AML
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 SAMPLE EXPANSIONS (with scores)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const samples = ['scc', 'rhabdomyosarcoma', 'aml', 'dlbcl', 'hepatocellular carcinoma']
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
