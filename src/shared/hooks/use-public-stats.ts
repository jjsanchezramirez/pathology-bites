// src/shared/hooks/use-public-stats.ts
// Simplified: No API calls, just hardcoded values for public landing page

export interface PublicStats {
  expertQuestions: number;
  images: number;
}

// Hardcoded public stats — refreshed at build time (see commit-workflow). Each is a floored
// "N+" figure so the displayed number never overstates the live database.
const PUBLIC_STATS: PublicStats = {
  expertQuestions: 300, // "300+" — live: 318 published questions, floored to nearest 50
  images: 1300, // "1,300+" — live: 1,349 images, floored to nearest 100
};

export function usePublicStats() {
  return {
    stats: PUBLIC_STATS,
    loading: false,
    error: null,
  };
}
