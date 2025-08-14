// src/features/anki/utils/interactive-cloze-processor.ts
import { ClozeMatch, ProcessedCloze } from '../types/anki-card'

const CLOZE_REGEX = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g

export interface InteractiveCloze extends ClozeMatch {
  id: string
  revealed: boolean
}

export interface InteractiveProcessedCloze {
  html: string
  clozes: InteractiveCloze[]
  allRevealed: boolean
}

/**
 * Process text with interactive cloze deletions
 * @param text - The text containing cloze deletions
 * @param revealedClozes - Set of cloze indices that have been revealed
 * @returns Processed cloze data with interactive HTML
 */
export function processInteractiveClozes(
  text: string,
  revealedClozes: Set<number> = new Set()
): InteractiveProcessedCloze {
  const clozes: InteractiveCloze[] = []
  let match: RegExpExecArray | null

  CLOZE_REGEX.lastIndex = 0

  // First, try to find standard Anki cloze format {{c1::content}}
  while ((match = CLOZE_REGEX.exec(text)) !== null) {
    const [full, indexStr, content, hint] = match
    const index = parseInt(indexStr, 10)

    clozes.push({
      id: `cloze-${index}`,
      full,
      content,
      hint,
      index,
      start: match.index,
      end: match.index + full.length,
      revealed: revealedClozes.has(index)
    })
  }

  // If no standard clozes found, look for pre-processed [...] placeholders
  if (clozes.length === 0) {
    const placeholderRegex = /\[\.+\]|\[…\]/g
    let placeholderMatch: RegExpExecArray | null
    let placeholderIndex = 1

    while ((placeholderMatch = placeholderRegex.exec(text)) !== null) {
      clozes.push({
        id: `cloze-${placeholderIndex}`,
        full: placeholderMatch[0],
        content: 'hidden content', // We don't know the original content
        hint: '...',
        index: placeholderIndex,
        start: placeholderMatch.index,
        end: placeholderMatch.index + placeholderMatch[0].length,
        revealed: revealedClozes.has(placeholderIndex)
      })
      placeholderIndex++
    }
  }
  // If still none, look for pre-rendered span-based clozes (e.g., Hemepath/AP content)
  if (clozes.length === 0) {
    const spanRegex = /<span([^>]*class=\"[^\"]*(?:cloze-revealed|cloze-hidden)[^\"]*\"[^>]*)>([\s\S]*?)<\/span>/gi
    let spanMatch: RegExpExecArray | null
    let idx = 1
    while ((spanMatch = spanRegex.exec(text)) !== null) {
      const full = spanMatch[0]
      const inner = spanMatch[2]
      clozes.push({
        id: `cloze-${idx}`,
        full,
        content: inner,
        hint: '...',
        index: idx,
        start: spanMatch.index,
        end: spanMatch.index + full.length,
        revealed: revealedClozes.has(idx)
      })
      idx++
    }
  }


  // Sort clozes by position (descending to avoid index issues when replacing)
  const sortedClozes = [...clozes].sort((a, b) => b.start - a.start)

  let processedHtml = text

  // Replace each cloze with interactive HTML
  for (const cloze of sortedClozes) {
    let replacement: string

    if (cloze.revealed) {
      // Show revealed cloze with content
      replacement = `<span class="cloze-revealed" data-cloze-id="${cloze.id}" data-cloze-index="${cloze.index}">${cloze.content}</span>`
    } else {
      // Show hidden cloze as clickable blank
      const hintText = cloze.hint ? cloze.hint : '...'
      replacement = `<span class="cloze-hidden" data-cloze-id="${cloze.id}" data-cloze-index="${cloze.index}" role="button" tabindex="0" title="Click to reveal">[${hintText}]</span>`
    }

    processedHtml = processedHtml.substring(0, cloze.start) +
                   replacement +
                   processedHtml.substring(cloze.end)
  }

  const allRevealed = clozes.length > 0 && clozes.every(c => c.revealed)

  return {
    html: processedHtml,
    clozes: clozes.sort((a, b) => a.start - b.start),
    allRevealed
  }
}

/**
 * Extract cloze information from text
 * @param text - The text containing cloze deletions
 * @returns Array of cloze information
 */
export function extractClozes(text: string): InteractiveCloze[] {
  const clozes: InteractiveCloze[] = []
  let match: RegExpExecArray | null

  CLOZE_REGEX.lastIndex = 0

  // First, try to find standard Anki cloze format
  while ((match = CLOZE_REGEX.exec(text)) !== null) {
    const [full, indexStr, content, hint] = match
    const index = parseInt(indexStr, 10)

    clozes.push({
      id: `cloze-${index}`,
      full,
      content,
      hint,
      index,
      start: match.index,
      end: match.index + full.length,
      revealed: false
    })
  }

  // If no standard clozes found, look for pre-processed [...] placeholders
  if (clozes.length === 0) {
    const placeholderRegex = /\[\.+\]|\[…\]/g
    let placeholderMatch: RegExpExecArray | null
    let placeholderIndex = 1

    while ((placeholderMatch = placeholderRegex.exec(text)) !== null) {
      clozes.push({
        id: `cloze-${placeholderIndex}`,
        full: placeholderMatch[0],
        content: 'hidden content',
        hint: '...',
        index: placeholderIndex,
        start: placeholderMatch.index,
        end: placeholderMatch.index + placeholderMatch[0].length,
        revealed: false
      })
      placeholderIndex++
    }
  }

  return clozes.sort((a, b) => a.index - b.index)
}

/**
 * Check if text has any cloze deletions
 */
export function hasInteractiveClozes(text: string): boolean {
  CLOZE_REGEX.lastIndex = 0
  // Check for standard Anki cloze format {{c1::content}}
  if (CLOZE_REGEX.test(text)) {
    return true
  }

  // Also check for already processed cloze placeholders like [...]
  // This handles cases where content has been pre-processed
  // Match [.], [...], [....], […], etc.
  return /\[\.+\]|\[…\]/.test(text)
}