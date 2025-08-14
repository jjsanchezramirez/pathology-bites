// src/features/anki/types/anki-card.ts

export interface AnkiNote {
  id: string
  guid: string
  noteId: number
  tags: string[]
  fields: Record<string, string>
  modelName: string
  cards: number[]
}

export interface AnkiCard {
  id: string
  cardId: number
  noteId: number
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags: string[]
  question: string
  answer: string
  css: string
  interval: number
  due: number
  factor: number
  reviews: number
  lapses: number
  left: number
  ord: number
  type: number
  queue: number
  mod: number
  usn: number
  reps: number
  ease: number
}

export interface AnkiDeck {
  id: string
  name: string
  cards: AnkiCard[]
  description?: string
  options?: AnkiDeckOptions
}

export interface AnkiDeckOptions {
  new: {
    bury: boolean
    delays: number[]
    initialFactor: number
    ints: number[]
    order: number
    perDay: number
  }
  lapse: {
    delays: number[]
    leechAction: number
    leechFails: number
    minInt: number
    mult: number
  }
  rev: {
    bury: boolean
    ease4: number
    fuzz: number
    ivlFct: number
    maxIvl: number
    perDay: number
  }
  timer: number
  autoplay: boolean
  replayq: boolean
}

export interface ClozeMatch {
  full: string
  content: string
  hint?: string
  index: number
  start: number
  end: number
}

export interface ProcessedCloze {
  text: string
  clozes: ClozeMatch[]
  activeClozeIndex?: number
}

export interface AnkiCardViewerProps {
  card: AnkiCard
  showAnswer?: boolean
  onAnswerToggle?: () => void
  onNext?: () => void
  onPrevious?: () => void
  className?: string
}

export interface AnkiDeckViewerProps {
  deck: AnkiDeck
  currentCardIndex?: number
  onCardChange?: (index: number) => void
  showAnswers?: boolean
  className?: string
}

// Anki card types
export type AnkiCardType = 'new' | 'learning' | 'review' | 'relearning'

// Anki queue types
export type AnkiQueueType = 'new' | 'learning' | 'review' | 'day_learning' | 'preview' | 'filtered'

// Answer ease levels
export type AnkiEase = 'again' | 'hard' | 'good' | 'easy'

export interface AnkiCardStats {
  cardType: AnkiCardType
  queueType: AnkiQueueType
  interval: number
  ease: number
  reviews: number
  lapses: number
  averageTime: number
  totalTime: number
}

export interface AnkiStudySession {
  deckId: string
  cards: AnkiCard[]
  currentIndex: number
  showAnswers: boolean
  startTime: Date
  answers: Array<{
    cardId: number
    ease: AnkiEase
    timeSpent: number
    timestamp: Date
  }>
}

// Types for parsing ankoma.json structure
export interface AnkomaNote {
  __type__: string
  fields: string[]
  guid: string
  note_model_uuid: string
  tags: string[]
}

export interface AnkomaDeck {
  __type__: string
  name: string
  children: AnkomaDeck[]
  notes: AnkomaNote[]
  crowdanki_uuid?: string
  deck_config_uuid?: string
  desc?: string
  media_files?: string[]
}

export interface AnkomaSection {
  id: string
  name: string
  path: string[]
  cardCount: number
  cards: AnkiCard[]
  subsections: AnkomaSection[]
}

export interface AnkomaData {
  sections: AnkomaSection[]
  totalCards: number
  lastLoaded: Date
}

// Enhanced viewer props for ankoma integration
export interface AnkomaViewerProps {
  autoLoad?: boolean
  defaultSection?: string
  onSectionChange?: (section: AnkomaSection) => void
  onError?: (error: string) => void
  className?: string
}
