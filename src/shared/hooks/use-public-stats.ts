// src/shared/hooks/use-public-stats.ts
// Simplified: No API calls, just hardcoded values for public landing page

export interface PublicStats {
  expertQuestions: number
  categories: number
}

// Hardcoded public stats - update these values manually when needed
const PUBLIC_STATS: PublicStats = {
  expertQuestions: 100, // "100+" expert-curated questions
  categories: 25        // 25 pathology subspecialties
}

export function usePublicStats() {
  return {
    stats: PUBLIC_STATS,
    loading: false,
    error: null
  }
}
