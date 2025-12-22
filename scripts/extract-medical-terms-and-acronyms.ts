#!/usr/bin/env tsx

/**
 * Smart Medical Term & Acronym Extraction from Virtual Slides
 *
 * Strategy:
 * 1. Extract all meaningful medical terms from diagnoses
 * 2. Generate potential acronyms from multi-word terms
 * 3. Use NCI EVS to validate which acronyms are real
 * 4. Count frequency of both full terms and acronyms
 */

interface VirtualSlide {
  diagnosis: string
  [key: string]: any
}

interface TermFrequency {
  term: string
  count: number
  potentialAcronyms: string[]
  examples: string[] // Sample diagnoses where this appears
}

const VIRTUAL_SLIDES_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'
const NCI_EVS_BASE = 'https://api-evsrest.nci.nih.gov/api/v1'
const RATE_LIMIT_DELAY = 200 // ms

// Common medical stop words to ignore
const STOP_WORDS = new Set([
  'with', 'without', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'from',
  'the', 'a', 'an', 'as', 'by', 'is', 'was', 'are', 'were', 'been', 'being',
  'nos', 'not', 'otherwise', 'specified', 'type', 'grade', 'stage', 'level',
  'positive', 'negative', 'low', 'high', 'intermediate', 'well', 'poorly',
  'moderately', 'differentiated', 'variant', 'subtype', 'pattern'
])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate potential acronyms from a multi-word term
 * E.g., "angiomyolipoma" → ["AML"]
 *       "alveolar rhabdomyosarcoma" → ["ARMS", "AR"]
 */
function generateAcronyms(term: string): string[] {
  const normalized = normalize(term)
  const words = normalized.split(' ').filter(w => !STOP_WORDS.has(w) && w.length > 2)

  const acronyms = new Set<string>()

  // Single word: first 2-4 letters
  if (words.length === 1) {
    const word = words[0]
    if (word.length >= 4) {
      acronyms.add(word.substring(0, 3).toUpperCase()) // First 3 letters
      acronyms.add(word.substring(0, 4).toUpperCase()) // First 4 letters
    }
  }

  // Multi-word: take first letter of each word
  if (words.length >= 2) {
    const firstLetters = words.map(w => w[0]).join('').toUpperCase()
    if (firstLetters.length >= 2 && firstLetters.length <= 5) {
      acronyms.add(firstLetters)
    }

    // Also try first 2-3 significant words only
    if (words.length >= 3) {
      const shortAcronym = words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
      if (shortAcronym.length >= 2) {
        acronyms.add(shortAcronym)
      }
    }
  }

  return Array.from(acronyms)
}

/**
 * Extract meaningful medical terms from diagnosis text
 */
function extractMedicalTerms(diagnosis: string): string[] {
  const normalized = normalize(diagnosis)
  const terms = new Set<string>()

  // Pattern 1: Explicit abbreviations (uppercase 2-5 letters)
  const abbrevMatches = diagnosis.match(/\b[A-Z]{2,5}\b/g)
  if (abbrevMatches) {
    abbrevMatches.forEach(abbrev => {
      // Skip common non-medical abbreviations
      if (!/^(WHO|IV|III|II|I|NOS|VS|FOR|AND|THE|WITH|TNM)$/.test(abbrev)) {
        terms.add(abbrev.toLowerCase())
      }
    })
  }

  // Pattern 2: Multi-word neoplasm terms (2-5 words ending in common suffixes)
  const neoplasmSuffixes = [
    'carcinoma', 'sarcoma', 'lymphoma', 'leukemia', 'melanoma', 'blastoma',
    'tumor', 'tumour', 'neoplasm', 'cancer', 'disease', 'syndrome',
    'adenoma', 'glioma', 'meningioma', 'schwannoma', 'astrocytoma',
    'lipoma', 'fibroma', 'myoma', 'hamartoma', 'teratoma'
  ]

  const words = normalized.split(/[,;.()]/).map(s => s.trim())

  for (const segment of words) {
    for (const suffix of neoplasmSuffixes) {
      if (segment.includes(suffix)) {
        // Extract phrase ending with this suffix
        const pattern = new RegExp(`([a-z]+\\s+){0,4}${suffix}`, 'g')
        const matches = segment.match(pattern)
        if (matches) {
          matches.forEach(match => {
            const cleaned = match.trim()
            const wordCount = cleaned.split(' ').length
            // Keep terms with 1-5 words
            if (wordCount >= 1 && wordCount <= 5 && cleaned.length >= 5) {
              terms.add(cleaned)
            }
          })
        }
      }
    }
  }

  // Pattern 3: Specific pathology entities (common patterns)
  const specificPatterns = [
    /\b(diffuse|follicular|marginal|mantle|burkitt|hodgkin)[\s\w]*lymphoma\b/gi,
    /\b(squamous|basal|transitional|urothelial|renal|hepatocellular)[\s\w]*carcinoma\b/gi,
    /\b(astrocytoma|glioblastoma|oligodendroglioma|ependymoma|meningioma)\b/gi,
    /\b(leiomyosarcoma|rhabdomyosarcoma|liposarcoma|angiosarcoma|fibrosarcoma)\b/gi,
    /\b(neuroblastoma|retinoblastoma|medulloblastoma|nephroblastoma)\b/gi,
  ]

  for (const pattern of specificPatterns) {
    const matches = diagnosis.match(pattern)
    if (matches) {
      matches.forEach(match => terms.add(normalize(match)))
    }
  }

  return Array.from(terms)
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Validate acronym with NCI EVS API
 */
async function validateAcronymWithNCI(acronym: string): Promise<boolean> {
  try {
    const searchUrl = new URL(`${NCI_EVS_BASE}/concept/ncit/search`)
    searchUrl.searchParams.set('term', acronym)
    searchUrl.searchParams.set('pageSize', '5')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })

    clearTimeout(timeoutId)

    if (!response.ok) return false

    const data = await response.json()
    const concepts = data?.concepts || []

    // Check if any result has neoplasm-related semantic types
    for (const concept of concepts) {
      if (concept.properties) {
        const semanticTypes = concept.properties
          .filter((p: any) => p.type === 'Semantic_Type')
          .map((p: any) => p.value)

        const isNeoplasm = semanticTypes.some((type: string) =>
          type.includes('Neoplastic') ||
          type.includes('Disease') ||
          type.includes('Pathologic')
        )

        if (isNeoplasm) return true
      }
    }

    return false
  } catch (error) {
    return false
  }
}

async function main() {
  console.log('🔬 Smart Medical Term & Acronym Extraction\n')
  console.log('Loading virtual slides dataset...\n')

  const response = await fetch(VIRTUAL_SLIDES_URL)
  const slides: VirtualSlide[] = await response.json()

  console.log(`✓ Loaded ${slides.length.toLocaleString()} slides\n`)
  console.log('Extracting medical terms and generating acronyms...\n')

  const termFrequencyMap = new Map<string, TermFrequency>()

  // Step 1: Extract all medical terms and count frequencies
  for (const slide of slides) {
    if (!slide.diagnosis) continue

    const terms = extractMedicalTerms(slide.diagnosis)

    for (const term of terms) {
      const existing = termFrequencyMap.get(term)

      if (existing) {
        existing.count++
        if (existing.examples.length < 3) {
          existing.examples.push(slide.diagnosis)
        }
      } else {
        const acronyms = generateAcronyms(term)
        termFrequencyMap.set(term, {
          term,
          count: 1,
          potentialAcronyms: acronyms,
          examples: [slide.diagnosis]
        })
      }
    }
  }

  // Step 2: Sort by frequency
  const sortedTerms = Array.from(termFrequencyMap.values())
    .sort((a, b) => b.count - a.count)

  console.log(`Found ${sortedTerms.length.toLocaleString()} unique medical terms\n`)

  // Step 3: Collect all unique acronyms
  const acronymSet = new Set<string>()

  for (const termData of sortedTerms) {
    // Add the term itself if it looks like an acronym (2-5 uppercase letters)
    if (/^[a-z]{2,5}$/.test(termData.term)) {
      acronymSet.add(termData.term)
    }
    // Add generated acronyms
    for (const acronym of termData.potentialAcronyms) {
      acronymSet.add(acronym.toLowerCase())
    }
  }

  console.log(`Generated ${acronymSet.size} unique potential acronyms\n`)

  // Step 4: Validate top acronyms with NCI EVS (sample for performance)
  const topAcronyms = Array.from(acronymSet).slice(0, 200)

  console.log('Validating acronyms with NCI EVS API (sampling top 200)...\n')

  const validAcronyms = new Set<string>()
  let validated = 0

  for (const acronym of topAcronyms) {
    validated++
    process.stdout.write(`[${validated.toString().padStart(3)}/${topAcronyms.length}] ${acronym.toUpperCase().padEnd(8)} ... `)

    const isValid = await validateAcronymWithNCI(acronym)

    if (isValid) {
      validAcronyms.add(acronym)
      console.log('✓ Valid neoplasm term')
    } else {
      console.log('✗ Not found/not neoplasm')
    }

    if (validated < topAcronyms.length) {
      await sleep(RATE_LIMIT_DELAY)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 RESULTS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log(`Total medical terms extracted: ${sortedTerms.length.toLocaleString()}`)
  console.log(`Potential acronyms generated: ${acronymSet.size}`)
  console.log(`Validated with NCI EVS: ${validAcronyms.size} / ${topAcronyms.length}\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔝 TOP 30 MEDICAL TERMS BY FREQUENCY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  sortedTerms.slice(0, 30).forEach((data, i) => {
    const acronyms = data.potentialAcronyms.length > 0
      ? ` → ${data.potentialAcronyms.join(', ')}`
      : ''
    console.log(`${(i + 1).toString().padStart(2)}. ${data.term.padEnd(40)} (${data.count}×)${acronyms}`)
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ VALIDATED ACRONYMS (for pre-computation)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const validAcronymsList = Array.from(validAcronyms).sort()
  validAcronymsList.forEach((acronym, i) => {
    if (i % 10 === 0 && i > 0) console.log('')
    process.stdout.write(acronym.toUpperCase().padEnd(8))
    if ((i + 1) % 10 === 0) console.log('')
  })

  console.log('\n\n💡 RECOMMENDATION:')
  console.log(`   Use these ${validAcronyms.size} validated acronyms for NCI EVS pre-computation`)
  console.log('   This will provide better coverage than simple regex extraction\n')

  // Save validated acronyms to file for next step
  const fs = await import('fs/promises')
  await fs.writeFile(
    'scripts/validated-acronyms.json',
    JSON.stringify({
      validated_acronyms: validAcronymsList,
      extraction_date: new Date().toISOString(),
      source: 'virtual_slides_dataset',
      total_slides: slides.length,
      total_terms_extracted: sortedTerms.length,
      validation_rate: `${validAcronyms.size}/${topAcronyms.length}`
    }, null, 2)
  )

  console.log('✅ Saved validated acronyms to: scripts/validated-acronyms.json\n')
}

main()
