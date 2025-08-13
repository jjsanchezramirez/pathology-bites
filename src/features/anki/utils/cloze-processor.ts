// src/features/anki/utils/cloze-processor.ts

import { ClozeMatch, ProcessedCloze } from '../types/anki-card'

/**
 * Regular expression to match Anki cloze deletions
 * Matches patterns like {{c1::content}} or {{c1::content::hint}}
 */
const CLOZE_REGEX = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g

/**
 * Process text containing Anki cloze deletions
 * @param text - The text containing cloze deletions
 * @param activeClozeIndex - The cloze index to show (others will be hidden)
 * @returns Processed cloze data
 */
export function processClozeText(text: string, activeClozeIndex?: number): ProcessedCloze {
  const clozes: ClozeMatch[] = []
  let match: RegExpExecArray | null
  
  // Reset regex lastIndex to ensure consistent behavior
  CLOZE_REGEX.lastIndex = 0
  
  // Find all cloze matches
  while ((match = CLOZE_REGEX.exec(text)) !== null) {
    const [full, indexStr, content, hint] = match
    const index = parseInt(indexStr, 10)
    
    clozes.push({
      full,
      content,
      hint,
      index,
      start: match.index,
      end: match.index + full.length
    })
  }
  
  // Sort clozes by their position in the text (descending to avoid index issues when replacing)
  clozes.sort((a, b) => b.start - a.start)
  
  let processedText = text
  
  // Replace clozes based on whether they should be shown or hidden
  for (const cloze of clozes) {
    let replacement: string
    
    if (activeClozeIndex !== undefined) {
      if (cloze.index === activeClozeIndex) {
        // Show this cloze as a blank with optional hint
        replacement = cloze.hint 
          ? `[${cloze.hint}]`
          : '[...]'
      } else {
        // Show other clozes as their content
        replacement = cloze.content
      }
    } else {
      // Show all clozes as their content (answer mode)
      replacement = cloze.content
    }
    
    processedText = processedText.substring(0, cloze.start) + 
                   replacement + 
                   processedText.substring(cloze.end)
  }
  
  // Sort clozes back to original order for return
  clozes.sort((a, b) => a.start - b.start)
  
  return {
    text: processedText,
    clozes,
    activeClozeIndex
  }
}

/**
 * Get all unique cloze indices from text
 * @param text - The text containing cloze deletions
 * @returns Array of unique cloze indices
 */
export function getClozeIndices(text: string): number[] {
  const indices = new Set<number>()
  let match: RegExpExecArray | null
  
  CLOZE_REGEX.lastIndex = 0
  
  while ((match = CLOZE_REGEX.exec(text)) !== null) {
    const index = parseInt(match[1], 10)
    indices.add(index)
  }
  
  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Check if text contains cloze deletions
 * @param text - The text to check
 * @returns True if text contains cloze deletions
 */
export function hasClozes(text: string): boolean {
  CLOZE_REGEX.lastIndex = 0
  return CLOZE_REGEX.test(text)
}

/**
 * Remove all cloze markup from text, showing only the content
 * @param text - The text containing cloze deletions
 * @returns Text with cloze markup removed
 */
export function stripClozeMarkup(text: string): string {
  return text.replace(CLOZE_REGEX, '$2')
}

/**
 * Generate question text for a specific cloze index
 * @param text - The original text with cloze deletions
 * @param clozeIndex - The cloze index to generate question for
 * @returns Question text with specified cloze hidden
 */
export function generateClozeQuestion(text: string, clozeIndex: number): string {
  return processClozeText(text, clozeIndex).text
}

/**
 * Generate answer text showing all clozes
 * @param text - The original text with cloze deletions
 * @returns Answer text with all clozes revealed
 */
export function generateClozeAnswer(text: string): string {
  return processClozeText(text).text
}
