// src/app/(public)/tools/virtual-slides/utils/search.ts

import { VirtualSlide, SearchIndex } from '../types'

// Helper function to generate acronym from phrase
export const generateAcronym = (phrase: string): string => {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0))
    .join('')
}

// Create acronym mapping for bidirectional search
export const createAcronymMap = (slides: VirtualSlide[]): Map<string, string[]> => {
  const map = new Map<string, string[]>()

  // Collect all unique diagnoses only (for performance)
  const allDiagnoses = new Set<string>()

  slides.forEach(slide => {
    if (slide.diagnosis) allDiagnoses.add(slide.diagnosis.toLowerCase())
  })

  // Build bidirectional mapping for diagnosis phrases only
  Array.from(allDiagnoses).forEach(diagnosis => {
    // Skip very short phrases or single words
    if (diagnosis.split(/\s+/).length < 2) return

    const acronym = generateAcronym(diagnosis)

    // Only create mappings for acronyms that are 2+ characters
    if (acronym.length >= 2) {
      // Map acronym to full phrase
      if (!map.has(acronym)) {
        map.set(acronym, [])
      }
      if (!map.get(acronym)!.includes(diagnosis)) {
        map.get(acronym)!.push(diagnosis)
      }

      // Map full phrase to acronym
      if (!map.has(diagnosis)) {
        map.set(diagnosis, [])
      }
      if (!map.get(diagnosis)!.includes(acronym)) {
        map.get(diagnosis)!.push(acronym)
      }
    }
  })

  return map
}

// Create search index for better performance
export const createSearchIndex = (slides: VirtualSlide[]): SearchIndex[] => {
  return slides.map((slide: VirtualSlide) => {
    const diagnosis = slide.diagnosis?.toLowerCase() || ''

    return {
      slide,
      diagnosis
    }
  })
}

// Get unique filter values
export const getUniqueRepositories = (slides: VirtualSlide[]): string[] => {
  const repos = [...new Set(slides.map((slide: VirtualSlide) => slide.repository))]
  return repos.filter(repo => repo && repo.trim() !== '').sort()
}

export const getUniqueCategories = (slides: VirtualSlide[]): string[] => {
  const cats = [...new Set(slides.map((slide: VirtualSlide) => slide.category))]
  return cats.filter(cat => cat && cat.trim() !== '').sort()
}

export const getUniqueOrganSystems = (slides: VirtualSlide[]): string[] => {
  const systems = [...new Set(slides.map((slide: VirtualSlide) => slide.subcategory))]
  return systems.filter(system => system && system.trim() !== '').sort()
}

// Helper function to escape regex special characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to check if a term appears as a complete word
const isCompleteWordMatch = (text: string, term: string): boolean => {
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i')
  return regex.test(text)
}

// Main search algorithm
export const searchSlides = (
  searchTerm: string,
  searchIndex: SearchIndex[]
): VirtualSlide[] => {
  if (!searchTerm.trim()) {
    return searchIndex.map(item => item.slide)
  }

  const term = searchTerm.toLowerCase().trim()
  const searchWords = term.split(/\s+/).filter(word => word.length > 0)

  // Generate acronym from search term if multi-word
  const searchAcronym = searchWords.length >= 2 ? 
    searchWords.map(word => word.charAt(0)).join('') : ''

  // Score each slide
  const scoredSlides: { slide: VirtualSlide; score: number }[] = []

  for (const indexItem of searchIndex) {
    const diagnosis = indexItem.diagnosis.toLowerCase()
    const diagnosisWords = diagnosis.split(/\s+/).filter(word => word.length > 0)
    const diagnosisAcronym = diagnosisWords.map(word => word.charAt(0)).join('')

    let score = 0

    // PRIORITY 1: Exact match (10000 points)
    if (diagnosis === term) {
      score = 10000
    }
    // PRIORITY 2: Search term acronym exactly matches diagnosis acronym (9000 points)
    // e.g., 'atypical lobular hyperplasia' → 'alh' matches diagnosis acronym 'alh'
    // Only for acronyms 3+ characters to avoid false positives like 'al' matching everything
    else if (searchAcronym && searchAcronym.length >= 3 && searchAcronym === diagnosisAcronym) {
      score = 9000
    }
    // PRIORITY 3: Search term is acronym and exactly matches diagnosis acronym (8000 points)
    // e.g., 'alh' exactly matches diagnosis acronym 'alh'
    // Only for acronyms 3+ characters to avoid false positives
    else if (term.length >= 3 && term === diagnosisAcronym) {
      score = 8000
    }
    // PRIORITY 4: Near exact match - diagnosis contains search term as complete words (7000 points)
    // e.g., 'atypical lobular hyperplasia' matches 'atypical lobular hyperplasia and invasive carcinoma'
    else if (isCompleteWordMatch(diagnosis, term)) {
      score = 7000
    }
    // PRIORITY 5: Search acronym appears as complete word in diagnosis (6000 points)
    // e.g., 'atypical lobular hyperplasia' → 'alh' matches 'alh and adh'
    // Only for acronyms 3+ characters to avoid false positives
    else if (searchAcronym && searchAcronym.length >= 3 && isCompleteWordMatch(diagnosis, searchAcronym)) {
      score = 6000
    }
    // PRIORITY 6: Search term (if acronym) appears as complete word in diagnosis (5000 points)
    // e.g., 'alh' matches 'alh and adh'
    // Only for acronyms 3+ characters to avoid false positives
    else if (term.length >= 3 && isCompleteWordMatch(diagnosis, term)) {
      score = 5000
    }
    // PRIORITY 7: Diagnosis starts with search term (4000 points)
    else if (diagnosis.startsWith(term)) {
      score = 4000
    }
    // PRIORITY 8: Individual word matches at word boundaries (3000 points)
    else {
      let wordBoundaryMatches = 0
      for (const searchWord of searchWords) {
        if (isCompleteWordMatch(diagnosis, searchWord)) {
          wordBoundaryMatches++
        }
      }
      if (wordBoundaryMatches > 0) {
        score = 3000 + (wordBoundaryMatches * 500) // Bonus for multiple word matches
      }
    }

    // PRIORITY 9: Substring matches (lower priority - 100-1000 points)
    if (score === 0) {
      // Check if search term appears as substring
      if (diagnosis.includes(term)) {
        score = 1000
      }
      // Check if search acronym appears as substring (lowest priority for cases like 'metALHead')
      // Only for acronyms 3+ characters to avoid false positives
      else if (searchAcronym && searchAcronym.length >= 3 && diagnosis.includes(searchAcronym)) {
        score = 500
      }
      // Check individual words as substrings
      else {
        let substringMatches = 0
        for (const searchWord of searchWords) {
          if (diagnosis.includes(searchWord)) {
            substringMatches++
          }
        }
        if (substringMatches > 0) {
          score = 100 + (substringMatches * 50)
        }
      }
    }

    // Additional bonus for multiple complete word matches
    if (score >= 3000) {
      let completeWordMatches = 0
      for (const searchWord of searchWords) {
        if (isCompleteWordMatch(diagnosis, searchWord)) {
          completeWordMatches++
        }
      }
      if (completeWordMatches > 1) {
        score *= (1 + (completeWordMatches - 1) * 0.1) // 10% bonus per additional word
      }
    }

    if (score > 0) {
      scoredSlides.push({ slide: indexItem.slide, score })
    }
  }

  // Sort by score (highest first) and return slides
  return scoredSlides
    .sort((a, b) => b.score - a.score)
    .map(item => item.slide)
}

// Apply filters to slides
export const applyFilters = (
  slides: VirtualSlide[],
  selectedRepository: string,
  selectedCategory: string,
  selectedOrganSystem: string
): VirtualSlide[] => {
  let filtered = slides

  // Apply repository filter
  if (selectedRepository !== 'all') {
    filtered = filtered.filter(slide => slide.repository === selectedRepository)
  }

  // Apply category filter
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(slide => slide.category === selectedCategory)
  }

  // Apply organ system filter
  if (selectedOrganSystem !== 'all') {
    filtered = filtered.filter(slide => slide.subcategory === selectedOrganSystem)
  }

  return filtered
}