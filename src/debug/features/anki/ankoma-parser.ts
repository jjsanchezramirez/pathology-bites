// src/features/anki/utils/ankoma-parser.ts

import { AnkomaDeck, AnkomaNote, AnkomaSection, AnkomaData, AnkiCard } from './types/anki-card'

/**
 * Parse ankoma.json structure into organized sections
 */
export function parseAnkomaData(rawData: AnkomaDeck): AnkomaData {
  const sections: AnkomaSection[] = []
  let totalCards = 0

  function processDeck(deck: AnkomaDeck, path: string[] = []): AnkomaSection[] {
    const currentPath = [...path, deck.name]
    const processedSections: AnkomaSection[] = []

    // Convert notes to cards
    const cards = deck.notes?.map((note, index) => convertNoteToCard(note, deck.name, index)) || []
    totalCards += cards.length

    // Process subsections (children)
    const subsections: AnkomaSection[] = []
    if (deck.children && deck.children.length > 0) {
      for (const child of deck.children) {
        const childSections = processDeck(child, currentPath)
        subsections.push(...childSections)
      }
    }

    // Create section if it has cards or meaningful subsections
    if (cards.length > 0 || subsections.length > 0) {
      const section: AnkomaSection = {
        id: generateSectionId(currentPath),
        name: deck.name,
        path: currentPath,
        cardCount: cards.length,
        cards,
        subsections
      }
      processedSections.push(section)
    }

    return processedSections
  }

  // Process the root deck
  if (rawData.children) {
    for (const child of rawData.children) {
      const childSections = processDeck(child)
      sections.push(...childSections)
    }
  }

  return {
    sections,
    totalCards,
    lastLoaded: new Date()
  }
}

/**
 * Convert AnkomaNote to AnkiCard
 */
function convertNoteToCard(note: AnkomaNote, deckName: string, index: number): AnkiCard {
  // Extract fields according to Ankoma structure (most AP/CP cloze cards)
  // Field 0: Header
  // Field 1: Text (front of card, with clozes)
  // Field 2: Extra
  // Field 3: Personal Notes
  // Field 4: Textbook (AP cards only)
  // Field 5: Citation
  const fields = note.fields || []

  // Detect Image Occlusion notes (all variants)
  // Known Note Model UUIDs present in ankoma.json for IOE variants
  const OCCLUSION_UUIDS = new Set([
    '8748b282-73b3-11f0-bc32-8b3dff665248', // IOE +++ (11 fields)
    '877ffc4c-73b3-11f0-bc32-8b3dff665248', // IOE + (compact)
    '8745afec-73b3-11f0-bc32-8b3dff665248'  // Legacy Image Occlusion
  ])

  // Heuristic: any field with inline <svg> or reference to an .svg mask or -Q.svg/-A.svg filenames
  const fieldContainsSvg = (s?: string) => !!s && (s.includes('<svg') || /\.svg(\"|')?/.test(s) || /-Q\.svg|-A\.svg/i.test(s))
  const anySvg = fields.some(f => fieldContainsSvg(f))

  const looksLikeIOE = OCCLUSION_UUIDS.has(note.note_model_uuid) || anySvg

  if (looksLikeIOE) {
    const idHidden = fields[0] || ''
    const header = fields[1] || ''
    const image = fields[2] || ''
    const footer = fields[3] || ''
    const remarks = fields[4] || ''
    const sources = fields[5] || ''
    const extra1 = fields[6] || ''
    const extra2 = fields[7] || ''
    const qMask = fields[8] || ''
    const aMask = fields[9] || ''
    const oMask = fields[10] || ''

    // Build question/answer HTML replicating the IOE template
    const questionHtml = `
      <div id="io-header">${header}</div>
      <div id="io-wrapper">
        <div id="io-overlay">${qMask}</div>
        <div id="io-original">${image}</div>
      </div>
      ${footer ? `<div id=\"io-footer\">${footer}</div>` : ''}
    `.trim()

    const answerExtras: string[] = []
    if (remarks.trim()) {
      answerExtras.push(`<div class="io-extra-entry"><div class="io-field-descr">Remarks</div>${remarks}</div>`)
    }
    if (sources.trim()) {
      answerExtras.push(`<div class="io-extra-entry"><div class="io-field-descr">Sources</div>${sources}</div>`)
    }
    if (extra1.trim()) {
      answerExtras.push(`<div class="io-extra-entry"><div class="io-field-descr">Extra 1</div>${extra1}</div>`)
    }
    if (extra2.trim()) {
      answerExtras.push(`<div class="io-extra-entry"><div class="io-field-descr">Extra 2</div>${extra2}</div>`)
    }

    const answerHtml = `
      <div id="io-header">${header}</div>
      <div id="io-wrapper">
        <div id="io-overlay">${aMask || qMask}</div>
        <div id="io-original">${image}</div>
      </div>
      ${footer ? `<div id=\"io-footer\">${footer}</div>` : ''}
      ${answerExtras.length ? `<div id=\"io-extra-wrapper\"><div id=\"io-extra\">${answerExtras.join('')}</div></div>` : ''}
    `.trim()

    return {
      id: note.guid || `${deckName}-${index}`,
      cardId: index + 1,
      noteId: parseInt(note.guid?.replace(/[^0-9]/g, '') || '0') || index,
      deckName,
      modelName: 'Image Occlusion Enhanced+++',
      fields: {
        'ID (hidden)': idHidden,
        Header: header,
        Image: image,
        Footer: footer,
        Remarks: remarks,
        Sources: sources,
        'Extra 1': extra1,
        'Extra 2': extra2,
        'Question Mask': qMask,
        'Answer Mask': aMask,
        'Original Mask': oMask
      },
      tags: [...(note.tags || []), '#image-occlusion'],
      question: questionHtml,
      answer: answerHtml,
      css: '',
      interval: 1,
      due: Date.now() + 24 * 60 * 60 * 1000,
      factor: 2500,
      reviews: 0,
      lapses: 0,
      left: 0,
      ord: 0,
      type: 0,
      queue: 0,
      mod: Date.now(),
      usn: 1,
      reps: 0,
      ease: 2500
    }
  }

  // Default (Cloze/Basic) path
  // Detect CP vs AP to map fields correctly (CP typically uses different field order)
  const AP_MODEL_UUID = 'cb0c02c4-e328-11ef-a4df-cf9f22b82781'
  const CP_MODEL_UUID = 'cb0a45d8-e328-11ef-a4df-cf9f22b82781'

  const isAPModel = note.note_model_uuid === AP_MODEL_UUID
  const isCPModel = note.note_model_uuid === CP_MODEL_UUID
  const tags = note.tags || []
  const isHemepathTag = tags.some(t => t.startsWith('#ANKOMA::CP::Hemepath'))
  const isCPTag = tags.some(t => t.startsWith('#ANKOMA::CP::') && !t.startsWith('#ANKOMA::CP::Hemepath'))

  // Treat Hemepath as AP format even if under CP deck/tags
  const treatAsAP = isAPModel || isHemepathTag || (!isCPModel && (!deckName.startsWith('CP') || deckName.includes('Hemepath')))
  const isCP = !treatAsAP && (isCPModel || isCPTag || deckName.startsWith('CP'))

  // Debug Hemepath cards specifically
  if (isHemepathTag || deckName.includes('Hemepath')) {
    console.log(`🩸 Hemepath card debug:`)
    console.log('- GUID:', note.guid)
    console.log('- Deck name:', deckName)
    console.log('- Tags:', note.tags)
    console.log('- Note model UUID:', note.note_model_uuid)
    console.log('- Mapping mode:', treatAsAP ? 'AP (fields[1]=text)' : 'CP (fields[0]=text)')
    console.log('- Fields count:', fields.length)
    console.log('- Fields:', fields.map((field, i) => `[${i}]: "${field?.substring(0, 100)}${field?.length > 100 ? '...' : ''}"`))
  }

  // For CP vs AP, the field order differs. Map explicitly.
  let header: string
  let text: string
  let extra: string
  let personalNotes: string
  let textbook: string
  let citation: string

  if (isCP) {
    // CP cards: [0]=Text, [1]=Extra, [2]=Personal Notes, [3]=Citation (sometimes [5])
    header = ''
    text = fields[0] || ''
    extra = fields[1] || ''
    personalNotes = fields[2] || ''
    textbook = ''
    citation = fields[3] || fields[5] || ''
  } else {
    // AP/basic (default for Hemepath): [0]=Header, [1]=Text, [2]=Extra, [3]=Personal Notes, [4]=Textbook, [5]=Citation
    header = fields[0] || ''
    text = fields[1] || ''
    extra = fields[2] || ''
    personalNotes = fields[3] || ''
    textbook = fields[4] || ''
    citation = fields[5] || ''
  }

  // Build the answer (back of card) from Extra, Personal Notes, Textbook, and Citation
  let answerParts = []

  if (extra.trim()) {
    answerParts.push(`<div class=\"extra-section\">${extra}</div>`)
  }

  if (personalNotes.trim()) {
    answerParts.push(`<div class=\"personal-notes-section\"><h4>Personal Notes</h4>${personalNotes}</div>`)
  }

  if (textbook.trim()) {
    answerParts.push(`<div class=\"textbook-section\"><h4>Textbook</h4>${textbook}</div>`)
  }

  if (citation.trim()) {
    // Split multiple citations and format them properly
    const citations = citation.split(/(?:<br\s*\/?>){2,}|(?:\n\s*){2,}/)
      .map(c => c.trim())
      .filter(c => c.length > 0)

    if (citations.length > 1) {
      // Multiple citations - minimal spacing without borders
      const formattedCitations = citations.map((cite, index) =>
        index > 0 ? `<div style="margin-top: 4px;">${cite}</div>` : cite
      ).join('')
      answerParts.push(`<div class=\"citation-section\"><h4>Citation</h4>${formattedCitations}</div>`)
    } else {
      // Single citation
      answerParts.push(`<div class=\"citation-section\"><h4>Citation</h4>${citation}</div>`)
    }
  }

  const answer = answerParts.join('')

  // Determine card type based on content
  let modelName = 'Basic'

  if (text.includes('{{c') && text.includes('::')) {
    modelName = 'Cloze'
  }

  return {
    id: note.guid || `${deckName}-${index}`,
    cardId: index + 1,
    noteId: parseInt(note.guid?.replace(/[^0-9]/g, '') || '0') || index,
    deckName,
    modelName,
    fields: {
      Header: header,
      Text: text,
      Extra: extra,
      'Personal Notes': personalNotes,
      Textbook: textbook,
      Citation: citation
    },
    tags: note.tags || [],
    question: text,
    answer,
    css: '',
    interval: 1,
    due: Date.now() + 24 * 60 * 60 * 1000,
    factor: 2500,
    reviews: 0,
    lapses: 0,
    left: 0,
    ord: 0,
    type: 0,
    queue: 0,
    mod: Date.now(),
    usn: 1,
    reps: 0,
    ease: 2500
  }
}

/**
 * Extract answer from cloze deletion text
 */
function extractAnswerFromCloze(text: string): string {
  if (!text) return ''
  
  // Replace cloze deletions with their content
  return text.replace(/\{\{c\d+::([^:}]+)(?:::([^}]+))?\}\}/g, '$1')
}

/**
 * Generate unique section ID from path
 */
function generateSectionId(path: string[]): string {
  return path.join('::').toLowerCase().replace(/[^a-z0-9:]/g, '-')
}

/**
 * Find section by ID
 */
export function findSectionById(sections: AnkomaSection[], id: string): AnkomaSection | null {
  for (const section of sections) {
    if (section.id === id) {
      return section
    }
    
    const found = findSectionById(section.subsections, id)
    if (found) {
      return found
    }
  }
  
  return null
}

/**
 * Get all cards from a section and its subsections
 */
export function getAllCardsFromSection(section: AnkomaSection): AnkiCard[] {
  const cards = [...section.cards]
  
  for (const subsection of section.subsections) {
    cards.push(...getAllCardsFromSection(subsection))
  }
  
  return cards
}

/**
 * Get section statistics
 */
export function getSectionStats(section: AnkomaSection): {
  totalCards: number
  directCards: number
  subsectionCount: number
  maxDepth: number
} {
  const directCards = section.cards.length
  let totalCards = directCards
  let maxDepth = 1
  
  for (const subsection of section.subsections) {
    const subStats = getSectionStats(subsection)
    totalCards += subStats.totalCards
    maxDepth = Math.max(maxDepth, subStats.maxDepth + 1)
  }
  
  return {
    totalCards,
    directCards,
    subsectionCount: section.subsections.length,
    maxDepth
  }
}

/**
 * Create a flattened list of all sections for easy navigation
 */
export function flattenSections(sections: AnkomaSection[]): AnkomaSection[] {
  const flattened: AnkomaSection[] = []
  
  function flatten(sectionList: AnkomaSection[]) {
    for (const section of sectionList) {
      flattened.push(section)
      if (section.subsections.length > 0) {
        flatten(section.subsections)
      }
    }
  }
  
  flatten(sections)
  return flattened
}

/**
 * Filter sections by name or content
 */
export function filterSections(sections: AnkomaSection[], query: string): AnkomaSection[] {
  const queryLower = query.toLowerCase()
  
  return sections.filter(section => {
    // Check section name
    if (section.name.toLowerCase().includes(queryLower)) {
      return true
    }
    
    // Check if any cards contain the query
    const hasMatchingCard = section.cards.some(card => 
      card.question.toLowerCase().includes(queryLower) ||
      card.answer.toLowerCase().includes(queryLower) ||
      card.tags.some(tag => tag.toLowerCase().includes(queryLower))
    )
    
    if (hasMatchingCard) {
      return true
    }
    
    // Check subsections
    const hasMatchingSubsection = filterSections(section.subsections, query).length > 0
    return hasMatchingSubsection
  })
}

/**
 * Load ankoma data directly from R2 with client-side caching
 * @deprecated Use useClientAnkoma hook instead for better performance and Vercel cost savings
 */
export async function loadAnkomaData(): Promise<AnkomaData> {
  try {
    console.log('🚀 Loading ankoma.json directly from R2...')
    
    const { ANKOMA_JSON_URL } = await import('@/shared/config/ankoma')

    const response = await fetch(ANKOMA_JSON_URL, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ankoma.json: ${response.status} ${response.statusText}`)
    }

    const rawData: AnkomaDeck = await response.json()
    const parsedData = parseAnkomaData(rawData)
    
    console.log(`🎉 Successfully loaded ${parsedData.totalCards.toLocaleString()} cards from R2 - your brain is about to get a workout!`)

    return parsedData
  } catch (error) {
    console.error('Error loading ankoma data:', error)
    throw new Error(`Failed to load Anki deck data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
