#!/usr/bin/env tsx

/**
 * Analyze Virtual Slides Dataset to Find Most Common Medical Terms
 *
 * This script:
 * 1. Downloads the virtual slides dataset
 * 2. Extracts all diagnoses
 * 3. Identifies potential abbreviations (2-5 letter uppercase words)
 * 4. Ranks by frequency
 * 5. Outputs top N for NCI EVS expansion
 */

const VIRTUAL_SLIDES_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'

interface VirtualSlide {
  diagnosis: string
}

// Extract potential abbreviations from text
function extractAbbreviations(text: string): string[] {
  const abbrevs: string[] = []

  // Match 2-5 letter uppercase words (likely abbreviations)
  const matches = text.match(/\b[A-Z]{2,5}\b/g)
  if (matches) {
    abbrevs.push(...matches.map(m => m.toLowerCase()))
  }

  return abbrevs
}

// Extract multi-word medical terms (for reverse lookup)
function extractMedicalTerms(text: string): string[] {
  const terms: string[] = []
  const lower = text.toLowerCase()

  // Common multi-word patterns
  const patterns = [
    // [descriptor] [organ/cell] [pathology type]
    /\b\w+\s+cell\s+(carcinoma|lymphoma|sarcoma|adenoma|tumor)\b/g,
    /\b(ductal|lobular|follicular|papillary)\s+carcinoma\b/g,
    /\b\w+\s+(lymphoma|leukemia|carcinoma)\b/g,
  ]

  for (const pattern of patterns) {
    const matches = lower.match(pattern)
    if (matches) {
      terms.push(...matches)
    }
  }

  return terms
}

async function analyzeDataset() {
  console.log('📊 Analyzing Virtual Slides Dataset...\n')

  try {
    // Fetch dataset
    console.log(`Fetching from: ${VIRTUAL_SLIDES_URL}`)
    const response = await fetch(VIRTUAL_SLIDES_URL)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const slides: VirtualSlide[] = await response.json()
    console.log(`✓ Loaded ${slides.length.toLocaleString()} virtual slides\n`)

    // Count abbreviations
    const abbrevCounts = new Map<string, number>()
    const termCounts = new Map<string, number>()
    const exampleDiagnoses = new Map<string, string>()

    for (const slide of slides) {
      if (!slide.diagnosis) continue

      // Extract abbreviations
      const abbrevs = extractAbbreviations(slide.diagnosis)
      for (const abbrev of abbrevs) {
        abbrevCounts.set(abbrev, (abbrevCounts.get(abbrev) || 0) + 1)
        if (!exampleDiagnoses.has(abbrev)) {
          exampleDiagnoses.set(abbrev, slide.diagnosis)
        }
      }

      // Extract medical terms
      const terms = extractMedicalTerms(slide.diagnosis)
      for (const term of terms) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1)
      }
    }

    // Sort by frequency
    const sortedAbbrevs = Array.from(abbrevCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)

    const sortedTerms = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)

    // Output results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 TOP 50 ABBREVIATIONS (by frequency in dataset)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('Rank | Abbrev | Count | Example Diagnosis')
    console.log('-----|--------|-------|------------------')

    for (let i = 0; i < Math.min(50, sortedAbbrevs.length); i++) {
      const [abbrev, count] = sortedAbbrevs[i]
      const example = exampleDiagnoses.get(abbrev) || ''
      const truncated = example.length > 50 ? example.substring(0, 47) + '...' : example
      console.log(`${(i + 1).toString().padStart(4)} | ${abbrev.toUpperCase().padEnd(6)} | ${count.toString().padStart(5)} | ${truncated}`)
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 TOP 30 MULTI-WORD MEDICAL TERMS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('Rank | Term                                    | Count')
    console.log('-----|------------------------------------------|-------')

    for (let i = 0; i < Math.min(30, sortedTerms.length); i++) {
      const [term, count] = sortedTerms[i]
      console.log(`${(i + 1).toString().padStart(4)} | ${term.padEnd(40)} | ${count.toString().padStart(5)}`)
    }

    // Generate JSON for pre-computing
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💾 RECOMMENDED TERMS FOR PRE-COMPUTATION')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const topTerms = [
      ...sortedAbbrevs.slice(0, 100).map(([abbrev]) => abbrev),
      ...sortedTerms.slice(0, 30).map(([term]) => term)
    ]

    console.log(`Total unique terms to pre-compute: ${topTerms.length}`)
    console.log('\nTop 20 abbreviations for NCI EVS lookup:')
    console.log(JSON.stringify(sortedAbbrevs.slice(0, 20).map(([a]) => a.toUpperCase()), null, 2))

    console.log('\n💡 RECOMMENDATION:')
    console.log('   1. Run NCI EVS expansion for these top 100 abbreviations')
    console.log('   2. Save to public/nci-evs-expansions.json')
    console.log('   3. Upload to R2 for CDN serving')
    console.log('   4. Update client to check static file first')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run analysis
analyzeDataset()
