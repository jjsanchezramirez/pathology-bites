/**
 * SIMPLE DIAGNOSTIC SEARCH V2 - Optimized with Pre-built Index
 *
 * Major improvement: Instead of loading all 24 files (~40MB), we:
 * 1. Load ONE pre-built optimized index file (~154KB) with topic metadata
 * 2. Search the lightweight index
 * 3. Load ONLY the matched file's content on-demand
 *
 * Resource savings:
 * - First load: 154KB instead of 40MB (99.6% less bandwidth!)
 * - Search time: ~5ms (index is tiny)
 * - Content load: Only when user needs it
 *
 * Index format v2.0.0:
 * - Deduplicated file metadata (stored once, referenced by ID)
 * - Compact array format instead of verbose objects
 * - Abbreviated categories (AP/CP instead of full names)
 * - Result: 82% smaller than v1.0.0 (154KB vs 837KB)
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { expandSearchTerm as expandWithUMLS } from './umls-expansion'
import { buildAcronymIndex, looksLikeAcronym, findTopicsByAcronym } from './acronym-generator'

// R2 configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// Optimized index format (v2.0.0)
interface OptimizedIndex {
  v: string // version
  ts: string // timestamp
  t: number // total topics
  f: Array<{
    n: string // filename
    c: string // category (abbreviated)
    s: string // subcategory
  }>
  e: Array<[string, number, string]> // entries: [topicName, fileId, lessonName]
}

// Expanded entry (for internal use)
interface IndexEntry {
  topicName: string
  lessonName: string
  fileName: string
  category: string
  subcategory: string
  normalizedTopicName: string
  normalizedLessonName: string
}

// Legacy format support (v1.0.0)
interface SearchIndex {
  version: string
  generated_at: string
  total_topics: number
  total_files: number
  entries: IndexEntry[]
}

interface SearchMatch {
  entry: IndexEntry
  matchType: 'exact' | 'starts_with' | 'contains' | 'abbreviation'
  matchScore: number
}

export interface SearchResult {
  type: 'single' | 'multiple' | 'none'
  // For single match
  entry?: IndexEntry
  content?: unknown
  matchType?: string
  // For multiple matches
  options?: IndexEntry[]
  // Metadata
  totalMatches: number
  searchTime: number
  indexSize?: number
}

/**
 * Normalize text for matching
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cache for expanded index entries
let expandedEntries: IndexEntry[] | null = null
let indexLoadedAt: number | null = null
let indexMetadata: { totalTopics: number; version: string } | null = null
let acronymIndex: Map<string, Set<string>> | null = null
const INDEX_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Expand category abbreviation
 */
function expandCategory(abbrev: string): string {
  const map: Record<string, string> = {
    'AP': 'Anatomic Pathology',
    'CP': 'Clinical Pathology',
  }
  return map[abbrev] || abbrev
}

/**
 * Load and expand optimized index from R2 (lightweight ~154KB file)
 */
async function loadSearchIndex(): Promise<IndexEntry[]> {
  // Return cache if valid
  if (expandedEntries && indexLoadedAt && (Date.now() - indexLoadedAt < INDEX_TTL)) {
    console.log('[Simple Search V2] Using cached index')
    return expandedEntries
  }

  console.log('[Simple Search V2] Loading optimized search index from R2...')
  const startTime = Date.now()

  const command = new GetObjectCommand({
    Bucket: 'pathology-bites-data',
    Key: 'context/search-index.json',
  })

  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 })
  const response = await fetch(signedUrl)

  if (!response.ok) {
    throw new Error(`Failed to load search index: ${response.status}`)
  }

  const rawIndex = await response.json()

  // Check if it's the optimized format (v2.0.0) or legacy format (v1.0.0)
  let entries: IndexEntry[]

  if (rawIndex.v && rawIndex.f && rawIndex.e) {
    // Optimized format v2.0.0
    const optimized = rawIndex as OptimizedIndex
    console.log(`[Simple Search V2] Using optimized format v${optimized.v}`)

    // Expand compact format into full entries
    entries = optimized.e.map(([topicName, fileId, lessonName]) => {
      const file = optimized.f[fileId]
      return {
        topicName,
        lessonName,
        fileName: file.n,
        category: expandCategory(file.c),
        subcategory: file.s,
        normalizedTopicName: normalize(topicName),
        normalizedLessonName: normalize(lessonName),
      }
    })

    indexMetadata = {
      totalTopics: optimized.t,
      version: optimized.v,
    }
  } else {
    // Legacy format v1.0.0
    const legacy = rawIndex as SearchIndex
    console.log(`[Simple Search V2] Using legacy format v${legacy.version}`)
    entries = legacy.entries

    indexMetadata = {
      totalTopics: legacy.total_topics,
      version: legacy.version,
    }
  }

  expandedEntries = entries
  indexLoadedAt = Date.now()

  // Build acronym index for fast acronym lookups
  console.log('[Simple Search V2] Building acronym index...')
  const acronymStartTime = Date.now()
  acronymIndex = buildAcronymIndex(entries)
  const acronymTime = Date.now() - acronymStartTime
  console.log(`[Simple Search V2] Built acronym index with ${acronymIndex.size} acronyms in ${acronymTime}ms`)

  const loadTime = Date.now() - startTime
  const sizeKB = Math.round(JSON.stringify(rawIndex).length / 1024)
  console.log(`[Simple Search V2] Loaded ${entries.length} topics in ${loadTime}ms (${sizeKB} KB)`)

  return entries
}

/**
 * Load content for a specific topic from its source file
 * This is ONLY called when we need to show the actual content
 */
async function loadTopicContent(fileName: string, topicName: string, lessonName: string): Promise<unknown> {
  console.log(`[Simple Search V2] Loading content for "${topicName}" from ${fileName}`)

  const command = new GetObjectCommand({
    Bucket: 'pathology-bites-data',
    Key: `context/${fileName}`,
  })

  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 })
  const response = await fetch(signedUrl)

  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}: ${response.status}`)
  }

  const data = await response.json()

  // Navigate to the specific topic
  const lesson = data?.subject?.lessons?.[lessonName]
  const topic = lesson?.topics?.[topicName]

  return topic?.content || null
}

/**
 * Search for topics in the index
 */
async function searchIndex(searchTerm: string): Promise<SearchMatch[]> {
  const entries = await loadSearchIndex()
  let searchVariants = await expandWithUMLS(searchTerm)
  const matches: SearchMatch[] = []

  console.log(`[Simple Search V2] Searching for: "${searchTerm}"`)

  // Check if the search term looks like an acronym and try acronym matching first
  if (looksLikeAcronym(searchTerm) && acronymIndex) {
    const acronymMatches = findTopicsByAcronym(searchTerm, acronymIndex)
    if (acronymMatches.length > 0) {
      console.log(`[Simple Search V2] Acronym match found! "${searchTerm}" → [${acronymMatches.join(', ')}]`)
      // Add acronym expansions to search variants
      searchVariants = [...searchVariants, ...acronymMatches]
    }
  }

  console.log(`[Simple Search V2] Search variants (${searchVariants.length}):`, searchVariants)

  for (const entry of entries) {
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

  console.log(`[Simple Search V2] Found ${matches.length} matches`)
  if (matches.length > 0) {
    console.log(`[Simple Search V2] Best match: "${matches[0].entry.topicName}" (${matches[0].matchType})`)
  }

  return matches
}

/**
 * Main search function
 */
export async function simpleSearchV2(searchTerm: string, loadContent: boolean = true): Promise<SearchResult> {
  const startTime = Date.now()
  const matches = await searchIndex(searchTerm)

  // No matches
  if (matches.length === 0) {
    return {
      type: 'none',
      totalMatches: 0,
      searchTime: Date.now() - startTime,
      indexSize: indexMetadata?.totalTopics,
    }
  }

  // Single exact match only (no auto-select for abbreviations)
  // Always show disambiguation if there are multiple matches
  if (matches.length === 1 || (matches[0].matchScore === 100 && matches.length < 3)) {
    const bestMatch = matches[0]

    // Load content only if requested
    let content = null
    if (loadContent) {
      try {
        content = await loadTopicContent(
          bestMatch.entry.fileName,
          bestMatch.entry.topicName,
          bestMatch.entry.lessonName
        )
      } catch (error) {
        console.error('[Simple Search V2] Failed to load content:', error)
      }
    }

    return {
      type: 'single',
      entry: bestMatch.entry,
      content,
      matchType: bestMatch.matchType,
      totalMatches: matches.length,
      searchTime: Date.now() - startTime,
      indexSize: indexMetadata?.totalTopics,
    }
  }

  // Multiple good matches - disambiguation needed
  return {
    type: 'multiple',
    options: matches.slice(0, 10).map(m => m.entry),
    totalMatches: matches.length,
    searchTime: Date.now() - startTime,
    indexSize: indexMetadata?.totalTopics,
  }
}

/**
 * Get content for a specific topic (used after disambiguation)
 */
export async function getTopicContent(fileName: string, topicName: string, lessonName: string): Promise<unknown> {
  return await loadTopicContent(fileName, topicName, lessonName)
}
