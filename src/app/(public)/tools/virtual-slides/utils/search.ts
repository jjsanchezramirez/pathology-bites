// src/app/(public)/tools/virtual-slides/utils/search.ts

import { VirtualSlide, SearchIndex } from "../types";
import { expandSearchTerm } from "@/wip/diagnostic-search/umls-expansion";

// Helper function to generate acronym from phrase
export const generateAcronym = (phrase: string): string => {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0))
    .join("");
};

// Create acronym mapping for bidirectional search
export const createAcronymMap = (slides: VirtualSlide[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();

  // Collect all unique diagnoses only (for performance)
  const allDiagnoses = new Set<string>();

  slides.forEach((slide) => {
    if (slide.diagnosis) allDiagnoses.add(slide.diagnosis.toLowerCase());
  });

  // Build bidirectional mapping for diagnosis phrases only
  Array.from(allDiagnoses).forEach((diagnosis) => {
    // Skip very short phrases or single words
    if (diagnosis.split(/\s+/).length < 2) return;

    const acronym = generateAcronym(diagnosis);

    // Only create mappings for acronyms that are 2+ characters
    if (acronym.length >= 2) {
      // Map acronym to full phrase
      if (!map.has(acronym)) {
        map.set(acronym, []);
      }
      if (!map.get(acronym)!.includes(diagnosis)) {
        map.get(acronym)!.push(diagnosis);
      }

      // Map full phrase to acronym
      if (!map.has(diagnosis)) {
        map.set(diagnosis, []);
      }
      if (!map.get(diagnosis)!.includes(acronym)) {
        map.get(diagnosis)!.push(acronym);
      }
    }
  });

  return map;
};

// Create search index for better performance
export const createSearchIndex = (slides: VirtualSlide[]): SearchIndex[] => {
  return slides.map((slide: VirtualSlide) => {
    const diagnosis = slide.diagnosis?.toLowerCase() || "";

    return {
      slide,
      diagnosis,
    };
  });
};

// Get unique filter values
export const getUniqueRepositories = (slides: VirtualSlide[]): string[] => {
  const repos = [...new Set(slides.map((slide: VirtualSlide) => slide.repository))];
  return repos.filter((repo) => repo && repo.trim() !== "").sort();
};

export const getUniqueCategories = (slides: VirtualSlide[]): string[] => {
  const cats = [...new Set(slides.map((slide: VirtualSlide) => slide.category))];
  return cats.filter((cat) => cat && cat.trim() !== "").sort();
};

export const getUniqueOrganSystems = (slides: VirtualSlide[]): string[] => {
  const systems = [...new Set(slides.map((slide: VirtualSlide) => slide.subcategory))];
  return systems.filter((system) => system && system.trim() !== "").sort();
};

// Helper function to escape regex special characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Helper function to check if a term appears as a complete word
const isCompleteWordMatch = (text: string, term: string): boolean => {
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  return regex.test(text);
};

// Helper function to score a single term against all slides
const scoreSlidesByTerm = (
  term: string,
  searchIndex: SearchIndex[]
): Map<string, { slide: VirtualSlide; score: number }> => {
  const termLower = term.toLowerCase().trim();
  const searchWords = termLower.split(/\s+/).filter((word) => word.length > 0);
  const searchAcronym =
    searchWords.length >= 2 ? searchWords.map((word) => word.charAt(0)).join("") : "";

  const slideScores = new Map<string, { slide: VirtualSlide; score: number }>();

  for (const indexItem of searchIndex) {
    const diagnosis = indexItem.diagnosis.toLowerCase();
    const diagnosisWords = diagnosis.split(/\s+/).filter((word) => word.length > 0);
    const diagnosisAcronym = diagnosisWords.map((word) => word.charAt(0)).join("");

    let score = 0;

    // PRIORITY 1: Exact match (10000 points)
    if (diagnosis === termLower) {
      score = 10000;
    }
    // PRIORITY 2: Search term acronym exactly matches diagnosis acronym (9000 points)
    else if (searchAcronym && searchAcronym.length >= 3 && searchAcronym === diagnosisAcronym) {
      score = 9000;
    }
    // PRIORITY 3: Search term is acronym and exactly matches diagnosis acronym (8000 points)
    else if (termLower.length >= 3 && termLower === diagnosisAcronym) {
      score = 8000;
    }
    // PRIORITY 4: Near exact match - diagnosis contains search term as complete words (7000 points)
    else if (isCompleteWordMatch(diagnosis, termLower)) {
      score = 7000;
    }
    // PRIORITY 5: Search acronym appears as complete word in diagnosis (6000 points)
    else if (
      searchAcronym &&
      searchAcronym.length >= 3 &&
      isCompleteWordMatch(diagnosis, searchAcronym)
    ) {
      score = 6000;
    }
    // PRIORITY 6: Search term (if acronym) appears as complete word in diagnosis (5000 points)
    else if (termLower.length >= 3 && isCompleteWordMatch(diagnosis, termLower)) {
      score = 5000;
    }
    // PRIORITY 7: Diagnosis starts with search term (4000 points)
    else if (diagnosis.startsWith(termLower)) {
      score = 4000;
    }
    // PRIORITY 8: Individual word matches at word boundaries (3000 points)
    else {
      let wordBoundaryMatches = 0;
      for (const searchWord of searchWords) {
        if (isCompleteWordMatch(diagnosis, searchWord)) {
          wordBoundaryMatches++;
        }
      }
      if (wordBoundaryMatches > 0) {
        score = 3000 + wordBoundaryMatches * 500;
      }
    }

    // PRIORITY 9: Substring matches (lower priority - 100-1000 points)
    if (score === 0) {
      if (diagnosis.includes(termLower)) {
        score = 1000;
      } else if (searchAcronym && searchAcronym.length >= 3 && diagnosis.includes(searchAcronym)) {
        score = 500;
      } else {
        let substringMatches = 0;
        for (const searchWord of searchWords) {
          if (diagnosis.includes(searchWord)) {
            substringMatches++;
          }
        }
        if (substringMatches > 0) {
          score = 100 + substringMatches * 50;
        }
      }
    }

    // Additional bonus for multiple complete word matches
    if (score >= 3000) {
      let completeWordMatches = 0;
      for (const searchWord of searchWords) {
        if (isCompleteWordMatch(diagnosis, searchWord)) {
          completeWordMatches++;
        }
      }
      if (completeWordMatches > 1) {
        score *= 1 + (completeWordMatches - 1) * 0.1;
      }
    }

    if (score > 0) {
      // Use slide ID or diagnosis as unique key
      const slideKey = indexItem.slide.id || indexItem.slide.diagnosis || Math.random().toString();
      const existing = slideScores.get(slideKey);

      // Keep the highest score for each slide
      if (!existing || score > existing.score) {
        slideScores.set(slideKey, { slide: indexItem.slide, score });
      }
    }
  }

  return slideScores;
};

// Main search algorithm (synchronous - no NCI EVS expansion)
export const searchSlides = (searchTerm: string, searchIndex: SearchIndex[]): VirtualSlide[] => {
  if (!searchTerm.trim()) {
    return searchIndex.map((item) => item.slide);
  }

  const slideScores = scoreSlidesByTerm(searchTerm, searchIndex);

  // Sort by score (highest first) and return slides
  return Array.from(slideScores.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.slide);
};

// Enhanced search with NCI EVS synonym expansion
export const searchSlidesWithExpansion = async (
  searchTerm: string,
  searchIndex: SearchIndex[]
): Promise<{ slides: VirtualSlide[]; expandedTerms: string[] }> => {
  if (!searchTerm.trim()) {
    return {
      slides: searchIndex.map((item) => item.slide),
      expandedTerms: [],
    };
  }

  // Expand search term using NCI EVS (includes original term + synonyms)
  const expandedTerms = await expandSearchTerm(searchTerm);
  console.log(
    `[Virtual Slides Search] Expanded "${searchTerm}" to ${expandedTerms.length} terms:`,
    expandedTerms
  );

  // Aggregate scores across all expanded terms
  const aggregatedScores = new Map<string, { slide: VirtualSlide; score: number }>();

  for (const term of expandedTerms) {
    const termScores = scoreSlidesByTerm(term, searchIndex);

    // Merge scores (keep highest score per slide)
    for (const [slideKey, { slide, score }] of termScores.entries()) {
      const existing = aggregatedScores.get(slideKey);

      if (!existing || score > existing.score) {
        aggregatedScores.set(slideKey, { slide, score });
      }
    }
  }

  // Sort by score (highest first) and return slides
  const sortedSlides = Array.from(aggregatedScores.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.slide);

  return {
    slides: sortedSlides,
    expandedTerms: expandedTerms.slice(1), // Exclude original term (first element)
  };
};

// Apply filters to slides
export const applyFilters = (
  slides: VirtualSlide[],
  selectedRepository: string,
  selectedCategory: string,
  selectedOrganSystem: string
): VirtualSlide[] => {
  let filtered = slides;

  // Apply repository filter
  if (selectedRepository !== "all") {
    filtered = filtered.filter((slide) => slide.repository === selectedRepository);
  }

  // Apply category filter
  if (selectedCategory !== "all") {
    filtered = filtered.filter((slide) => slide.category === selectedCategory);
  }

  // Apply organ system filter
  if (selectedOrganSystem !== "all") {
    filtered = filtered.filter((slide) => slide.subcategory === selectedOrganSystem);
  }

  return filtered;
};
