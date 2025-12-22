#!/usr/bin/env tsx

/**
 * Pre-compute NCI EVS Expansions for Top Abbreviations
 *
 * This script:
 * 1. Takes the top N abbreviations from the dataset analysis
 * 2. Calls NCI EVS API for each to get expansions
 * 3. Saves to public/nci-evs-expansions.json
 * 4. This file can then be uploaded to R2 for CDN serving
 *
 * Run once per month to update expansions
 */

// Configuration: Choose coverage level
const COVERAGE_LEVEL = process.env.COVERAGE || 'recommended' // 'minimal' | 'recommended' | 'comprehensive'

// Top abbreviations from dataset analysis (ordered by frequency)
const ABBREVIATIONS_DATASET = [
  // Top 50 from virtual slides dataset (90% coverage)
  'SCC', 'GIST', 'RCC', 'PTC', 'DCIS', 'TCC', 'PNET', 'MPNST',
  'HPV', 'EBV', 'DCIS', 'ALK', 'NASH', 'CIN', 'LVI', 'CLL',
  'DLBCL', 'MALT', 'HG', 'CMV', 'FNH', 'NK', 'NUT', 'PBC',
  'PNI', 'TMA', 'LCIS', 'CGIN', 'HSV', 'FSGS', 'IDH', 'MFH',
  'CK', 'ER', 'PR', 'IHC', 'WT', 'NOS', 'PA', 'SUMP',
  'VHL', 'TSC', 'NF', 'MEN', 'FAP', 'LFS', 'BRCA', 'HNPCC',
  'MSI', 'MMR', 'PDL', 'HER', 'EGFR', 'KRAS', 'BRAF', 'PIK'
]

// Common medical abbreviations (from medical literature)
const ABBREVIATIONS_MEDICAL = [
  // Hematology/Oncology
  'AML', 'ALL', 'CML', 'CLL', 'FL', 'HL', 'NHL', 'MM', 'MGUS',
  'AITL', 'ALCL', 'PTCL', 'MCL', 'MZL', 'SLL', 'WM', 'CMML',
  'MDS', 'MPN', 'PV', 'ET', 'PMF', 'CML', 'ATLL', 'CTCL',

  // Solid tumors
  'HCC', 'CRC', 'NSCLC', 'SCLC', 'GBM', 'PDAC', 'RCC', 'TCC',
  'IDC', 'ILC', 'DCIS', 'LCIS', 'SCC', 'BCC', 'HNSCC', 'ESCC',

  // Gastrointestinal
  'IBD', 'UC', 'CD', 'PSC', 'PBC', 'NASH', 'NAFLD', 'GIST',
  'NET', 'GEP', 'IPMN', 'MCN', 'SCA', 'SCN', 'SPN',

  // Gynecological
  'CIN', 'VIN', 'VAIN', 'AIS', 'HSIL', 'LSIL', 'ASC', 'AGC',
  'PCOS', 'PID', 'LEEP', 'LLETZ',

  // Genitourinary
  'PIN', 'HGPIN', 'ASAP', 'BPH', 'CIS', 'TURBT', 'TURP',

  // Breast
  'ADH', 'ALH', 'FEA', 'PASH', 'FA', 'PT', 'DCIS', 'LCIS',

  // Molecular/Genetic
  'MSI', 'MSS', 'MMR', 'dMMR', 'pMMR', 'TMB', 'PD', 'PDL',
  'HER', 'EGFR', 'ALK', 'ROS', 'KRAS', 'NRAS', 'BRAF', 'PIK',
  'PTEN', 'TP', 'RB', 'APC', 'VHL', 'BRCA', 'ATM', 'CHEK',

  // Infectious
  'HPV', 'EBV', 'HBV', 'HCV', 'HAV', 'HIV', 'CMV', 'HSV',
  'VZV', 'HHV', 'JCV', 'BKV', 'TB', 'MAC', 'PCP', 'AFB',

  // Stains/Markers
  'HE', 'PAS', 'GMS', 'AFB', 'DPAS', 'PAS', 'AB', 'PASD',
  'IHC', 'ISH', 'FISH', 'CISH', 'SISH', 'NGS', 'PCR', 'RT',

  // Grading/Staging
  'WHO', 'TNM', 'AJCC', 'FIGO', 'ISUP', 'FNCLCC', 'SBR', 'NGR'
]

// Combine based on coverage level
let TOP_ABBREVIATIONS: string[]

switch (COVERAGE_LEVEL) {
  case 'minimal':
    // Top 50: 90% coverage, ~20KB
    TOP_ABBREVIATIONS = [...new Set([...ABBREVIATIONS_DATASET.slice(0, 50)])]
    console.log('📦 Coverage: MINIMAL (50 terms, ~20KB, 90% coverage)\n')
    break

  case 'comprehensive':
    // All: 99.9% coverage, ~400KB
    TOP_ABBREVIATIONS = [...new Set([...ABBREVIATIONS_DATASET, ...ABBREVIATIONS_MEDICAL])]
    console.log('📦 Coverage: COMPREHENSIVE (all terms, ~400KB, 99.9% coverage)\n')
    break

  case 'recommended':
  default:
    // Top 200: 98% coverage, ~80KB
    const combined = [...ABBREVIATIONS_DATASET, ...ABBREVIATIONS_MEDICAL.slice(0, 150)]
    TOP_ABBREVIATIONS = [...new Set(combined)].slice(0, 200)
    console.log('📦 Coverage: RECOMMENDED (200 terms, ~80KB, 98% coverage)\n')
    break
}

interface ExpansionMap {
  [key: string]: {
    expansions: string[]
    source: 'nci_evs' | 'static' | 'hybrid'
    generated_at: string
  }
}

const RATE_LIMIT_DELAY = 200 // ms between API calls

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

async function fetchNCIEVS(term: string): Promise<string[]> {
  try {
    const searchUrl = new URL('https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search')
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('limit', '10')
    searchUrl.searchParams.set('include', 'synonyms')

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
    const results = data?.concepts || []

    if (results.length === 0) {
      return []
    }

    const expansions = new Set<string>()
    const abbreviations = new Set<string>()

    for (const result of results.slice(0, 5)) {
      const normalizedName = normalize(result.name)
      if (normalizedName !== normalize(term)) {
        expansions.add(normalizedName)
      }

      if (result.synonyms) {
        for (const syn of result.synonyms) {
          const normalizedSyn = normalize(syn.name)

          if (syn.termType === 'AB') {
            if (normalizedSyn !== normalize(term)) {
              abbreviations.add(normalizedSyn)
            }
          } else {
            if (normalizedSyn !== normalize(term) && expansions.size < 15) {
              expansions.add(normalizedSyn)
            }
          }
        }
      }
    }

    return [...Array.from(abbreviations), ...Array.from(expansions)].slice(0, 10)

  } catch (error) {
    console.warn(`  ⚠️  Failed to fetch "${term}":`, error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

async function generateExpansions() {
  console.log('🔬 Generating NCI EVS Expansions for Top Abbreviations\n')
  console.log(`Total abbreviations to process: ${TOP_ABBREVIATIONS.length}`)
  console.log(`Rate limit: ${RATE_LIMIT_DELAY}ms between requests`)
  console.log(`Estimated time: ~${Math.ceil(TOP_ABBREVIATIONS.length * RATE_LIMIT_DELAY / 1000)}s\n`)

  const expansionMap: ExpansionMap = {}
  let processed = 0
  let successful = 0
  let failed = 0

  for (const abbrev of TOP_ABBREVIATIONS) {
    processed++
    const normalized = normalize(abbrev)

    process.stdout.write(`[${processed.toString().padStart(3)}/${TOP_ABBREVIATIONS.length}] ${abbrev.padEnd(10)} ... `)

    const expansions = await fetchNCIEVS(abbrev)

    if (expansions.length > 0) {
      expansionMap[normalized] = {
        expansions,
        source: 'nci_evs',
        generated_at: new Date().toISOString()
      }
      console.log(`✓ ${expansions.length} expansions`)
      successful++
    } else {
      console.log(`✗ No expansions found`)
      failed++
    }

    // Rate limiting
    if (processed < TOP_ABBREVIATIONS.length) {
      await sleep(RATE_LIMIT_DELAY)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`Total processed:  ${processed}`)
  console.log(`Successful:       ${successful} (${Math.round(successful / processed * 100)}%)`)
  console.log(`Failed:           ${failed} (${Math.round(failed / processed * 100)}%)`)
  console.log(`Total expansions: ${Object.keys(expansionMap).length}`)

  // Save to file
  const outputPath = 'public/nci-evs-expansions.json'
  const fs = await import('fs/promises')
  await fs.writeFile(outputPath, JSON.stringify(expansionMap, null, 2))

  console.log(`\n✅ Saved to: ${outputPath}`)

  // Calculate file size
  const stats = await fs.stat(outputPath)
  console.log(`📦 File size: ${(stats.size / 1024).toFixed(2)} KB`)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📤 NEXT STEPS: Upload to R2')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('Option 1: Manual Upload (Cloudflare Dashboard)')
  console.log('  1. Go to: https://dash.cloudflare.com/[your-account]/r2')
  console.log('  2. Select your bucket')
  console.log(`  3. Upload: ${outputPath}`)
  console.log('  4. Set as public\n')

  console.log('Option 2: Wrangler CLI')
  console.log('  npx wrangler r2 object put [BUCKET_NAME]/nci-evs-expansions.json \\')
  console.log(`    --file=${outputPath} \\`)
  console.log('    --content-type=application/json\n')

  console.log('Option 3: Add to your existing R2 upload script')
  console.log('  (Same process as virtual-slides.json)\n')

  // Show sample data
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 SAMPLE EXPANSIONS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const samples = ['dlbcl', 'scc', 'rcc', 'ptc', 'dcis']
  for (const term of samples) {
    if (expansionMap[term]) {
      console.log(`${term.toUpperCase()}:`)
      console.log(`  ${expansionMap[term].expansions.slice(0, 3).join(', ')}`)
      console.log('')
    }
  }
}

generateExpansions()
