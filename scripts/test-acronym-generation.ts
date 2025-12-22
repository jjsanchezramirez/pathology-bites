/**
 * Test Acronym Generation
 *
 * Verifies that medical terms generate correct acronyms
 */

import { generateAcronyms, buildAcronymIndex, looksLikeAcronym, findTopicsByAcronym, debugTopicAcronyms } from '../src/app/api/public/tools/diagnostic-search/acronym-generator'

console.log('='.repeat(70))
console.log('ACRONYM GENERATION TEST')
console.log('='.repeat(70))
console.log()

// Test cases with expected acronyms
const testCases = [
  {
    name: 'Diffuse Large B-Cell Lymphoma',
    expected: ['dlbcl'] // primary acronym
  },
  {
    name: 'Acute Myeloid Leukemia',
    expected: ['aml']
  },
  {
    name: 'Respiratory Epithelial Adenomatoid Hamartoma',
    expected: ['reah']
  },
  {
    name: 'Chronic Lymphocytic Leukemia',
    expected: ['cll']
  },
  {
    name: 'Hepatocellular Carcinoma',
    expected: ['hc']
  },
  {
    name: 'Gastrointestinal Stromal Tumor',
    expected: ['gst']
  },
  {
    name: 'Peripheral T-Cell Lymphoma',
    expected: ['ptcl'] // primary acronym
  },
  {
    name: 'Anaplastic Large Cell Lymphoma',
    expected: ['alcl'] // primary acronym
  },
  {
    name: 'Follicular Lymphoma',
    expected: ['fl']
  },
  {
    name: 'Mantle Cell Lymphoma',
    expected: ['mcl']
  },
  {
    name: 'Clear Cell Renal Cell Carcinoma',
    expected: ['ccrcc']
  },
  {
    name: 'Small Cell Lung Cancer',
    expected: ['sclc']
  },
  {
    name: 'Ductal Carcinoma In Situ',
    expected: ['dcis'] // includes "in"
  },
  {
    name: 'Lobular Carcinoma In Situ',
    expected: ['lcis'] // includes "in"
  },
]

console.log('Testing acronym generation for common medical terms:')
console.log('-'.repeat(70))

let passed = 0
let failed = 0

for (const { name, expected } of testCases) {
  const generated = generateAcronyms(name)
  const allExpectedFound = expected.every(exp => generated.includes(exp))

  const status = allExpectedFound ? '✓' : '✗'
  const result = allExpectedFound ? 'PASS' : 'FAIL'

  console.log(`${status} ${name}`)
  console.log(`  Expected: [${expected.join(', ')}]`)
  console.log(`  Generated: [${generated.join(', ')}]`)
  console.log(`  Status: ${result}`)
  console.log()

  if (allExpectedFound) {
    passed++
  } else {
    failed++
  }
}

console.log('='.repeat(70))
console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)
console.log('='.repeat(70))
console.log()

// Test acronym detection
console.log('Testing acronym detection:')
console.log('-'.repeat(70))

const acronymTests = [
  { term: 'DLBCL', expected: true },
  { term: 'dlbcl', expected: true },
  { term: 'AML', expected: true },
  { term: 'melanoma', expected: false }, // full word
  { term: 'diffuse large', expected: false }, // has space
  { term: 'A', expected: false }, // too short
  { term: 'VERYLONGACRONYM123', expected: false }, // too long
  { term: 'ABC123', expected: true },
]

for (const { term, expected } of acronymTests) {
  const result = looksLikeAcronym(term)
  const status = result === expected ? '✓' : '✗'
  console.log(`${status} "${term}" → ${result} (expected: ${expected})`)
}

console.log()
console.log('='.repeat(70))
console.log('Testing acronym index and lookup:')
console.log('-'.repeat(70))

// Create mock topic entries
const mockTopics = [
  { topicName: 'Diffuse Large B-Cell Lymphoma', normalizedTopicName: 'diffuse large b cell lymphoma' },
  { topicName: 'Acute Myeloid Leukemia', normalizedTopicName: 'acute myeloid leukemia' },
  { topicName: 'Chronic Lymphocytic Leukemia', normalizedTopicName: 'chronic lymphocytic leukemia' },
  { topicName: 'Respiratory Epithelial Adenomatoid Hamartoma', normalizedTopicName: 'respiratory epithelial adenomatoid hamartoma' },
]

const index = buildAcronymIndex(mockTopics)

console.log(`Built index with ${index.size} unique acronyms`)
console.log()

// Test lookups
const lookupTests = [
  { acronym: 'DLBCL', expectedTopics: ['diffuse large b cell lymphoma'] },
  { acronym: 'AML', expectedTopics: ['acute myeloid leukemia'] },
  { acronym: 'CLL', expectedTopics: ['chronic lymphocytic leukemia'] },
  { acronym: 'REAH', expectedTopics: ['respiratory epithelial adenomatoid hamartoma'] },
  { acronym: 'XYZ', expectedTopics: [] }, // should not match
]

for (const { acronym, expectedTopics } of lookupTests) {
  const found = findTopicsByAcronym(acronym, index)
  const matches = expectedTopics.every(exp => found.includes(exp))
  const status = matches ? '✓' : '✗'

  console.log(`${status} Lookup "${acronym}":`)
  console.log(`  Expected: [${expectedTopics.join(', ')}]`)
  console.log(`  Found: [${found.join(', ')}]`)
  console.log()
}

console.log('='.repeat(70))
console.log('Debug output for specific topics:')
console.log('-'.repeat(70))

const debugTopics = [
  'Diffuse Large B-Cell Lymphoma, Not Otherwise Specified',
  'T-Cell/Histiocyte-Rich Large B-Cell Lymphoma',
  'Primary Cutaneous Anaplastic Large Cell Lymphoma',
]

debugTopics.forEach(debugTopicAcronyms)

console.log('='.repeat(70))
console.log('ACRONYM GENERATION TEST COMPLETE')
console.log('='.repeat(70))
