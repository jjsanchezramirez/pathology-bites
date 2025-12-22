/**
 * Automatic Acronym Generator for Medical Terms
 *
 * Generates acronyms from topic names to improve search matching:
 * - "Diffuse Large B-Cell Lymphoma" → "DLBCL"
 * - "Respiratory Epithelial Adenomatoid Hamartoma" → "REAH"
 * - "Acute Myeloid Leukemia" → "AML"
 *
 * Features:
 * - Ignores punctuation (B-cell = B cell)
 * - Handles common medical word patterns
 * - Filters out common words (the, of, and, etc.)
 * - Supports multi-word acronyms
 */

// Common words to skip when generating acronyms
const SKIP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'and', 'or', 'but', 'not', 'type', 'nos', 'variant', 'otherwise', 'specified'
])

// Words that should always be included even if short or in SKIP_WORDS
// These are important medical context words
const ALWAYS_INCLUDE = new Set([
  'b', 't', // B-cell, T-cell
  'nk', // NK cells
  'in', // "in situ" is important!
])

/**
 * Normalize text for acronym generation
 * Removes punctuation but preserves spaces
 */
function normalizeForAcronym(text: string): string {
  return text
    .toLowerCase()
    // Remove all punctuation but keep spaces
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if a word should be included in the acronym
 */
function shouldIncludeWord(word: string): boolean {
  // Always include certain important words
  if (ALWAYS_INCLUDE.has(word)) {
    return true
  }

  // Skip common words
  if (SKIP_WORDS.has(word)) {
    return false
  }

  // Skip very short words (1 letter) unless in ALWAYS_INCLUDE
  if (word.length < 2) {
    return false
  }

  return true
}

/**
 * Generate acronyms from a topic name
 * Returns an array of possible acronyms
 */
export function generateAcronyms(topicName: string): string[] {
  const normalized = normalizeForAcronym(topicName)
  const words = normalized.split(/\s+/).filter(w => w.length > 0)

  const acronyms: Set<string> = new Set()

  // Generate main acronym from first letters
  const mainAcronym = words
    .filter(shouldIncludeWord)
    .map(word => word[0])
    .join('')

  if (mainAcronym.length >= 2) {
    acronyms.add(mainAcronym)
  }

  // Generate variations without common words
  // Example: "Diffuse Large B-Cell Lymphoma, Not Otherwise Specified"
  // → "DLBCL" (without "not otherwise specified")

  // Try variations excluding trailing common words
  for (let i = words.length - 1; i >= 0; i--) {
    if (SKIP_WORDS.has(words[i])) {
      const variant = words
        .slice(0, i)
        .filter(shouldIncludeWord)
        .map(word => word[0])
        .join('')

      if (variant.length >= 2) {
        acronyms.add(variant)
      }
    }
  }

  // For hyphenated terms, try including just the first part
  // Example: "T-Cell Lymphoma" → "TCL" and "TL"
  const wordsWithoutHyphens = normalized
    .replace(/-/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)

  if (wordsWithoutHyphens.length !== words.length) {
    const compactAcronym = wordsWithoutHyphens
      .filter(shouldIncludeWord)
      .map(word => word[0])
      .join('')

    if (compactAcronym.length >= 2) {
      acronyms.add(compactAcronym)
    }
  }

  // Filter out very long acronyms (likely not real)
  return Array.from(acronyms)
    .filter(a => a.length >= 2 && a.length <= 10)
}

/**
 * Generate reverse mapping: acronym → topic names
 * Used to quickly find which topics match a given acronym
 */
export function buildAcronymIndex(topicEntries: Array<{ topicName: string; normalizedTopicName: string }>): Map<string, Set<string>> {
  const acronymIndex = new Map<string, Set<string>>()

  for (const entry of topicEntries) {
    const acronyms = generateAcronyms(entry.topicName)

    for (const acronym of acronyms) {
      if (!acronymIndex.has(acronym)) {
        acronymIndex.set(acronym, new Set())
      }
      acronymIndex.get(acronym)!.add(entry.normalizedTopicName)
    }
  }

  return acronymIndex
}

/**
 * Common full medical terms that might look like acronyms but aren't
 */
const COMMON_FULL_WORDS = new Set([
  'melanoma', 'lymphoma', 'leukemia', 'carcinoma', 'sarcoma', 'adenoma',
  'cancer', 'tumor', 'syndrome', 'disease', 'cell', 'cells'
])

/**
 * Check if a search term might be an acronym
 * (short, all caps or all lowercase, no spaces)
 */
export function looksLikeAcronym(term: string): boolean {
  const normalized = term.trim().toLowerCase()

  // Exclude common full medical words
  if (COMMON_FULL_WORDS.has(normalized)) {
    return false
  }

  // 2-10 characters, no spaces, mostly letters
  return (
    normalized.length >= 2 &&
    normalized.length <= 10 &&
    !normalized.includes(' ') &&
    /^[a-z0-9]+$/.test(normalized)
  )
}

/**
 * Get topic names that match a given acronym
 */
export function findTopicsByAcronym(
  acronym: string,
  acronymIndex: Map<string, Set<string>>
): string[] {
  const normalized = acronym.toLowerCase()
  const matches = acronymIndex.get(normalized)
  return matches ? Array.from(matches) : []
}

/**
 * Debug function to show all acronyms for a topic
 */
export function debugTopicAcronyms(topicName: string): void {
  const acronyms = generateAcronyms(topicName)
  console.log(`Topic: "${topicName}"`)
  console.log(`Acronyms: ${acronyms.join(', ')}`)
  console.log()
}
