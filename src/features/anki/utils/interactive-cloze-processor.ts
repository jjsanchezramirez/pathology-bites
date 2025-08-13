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
  
  // Find all cloze matches
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
  
  return clozes.sort((a, b) => a.index - b.index)
}

/**
 * Check if text has any cloze deletions
 */
export function hasInteractiveClozes(text: string): boolean {
  CLOZE_REGEX.lastIndex = 0
  return CLOZE_REGEX.test(text)
}