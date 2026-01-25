"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRepositoryFromId } from "@/shared/utils/repository";
import { expandSearchTermClient } from "@/shared/utils/nci-evs-client";
import { extractOrganTerms, getOrganBoostScore, type OrganTerm } from "@/shared/utils/organ-terms";
import { MEDICAL_ACRONYMS, COMMON_MEDICAL_TERMS } from "@/shared/utils/medical-acronyms";

// Module-scope cache for request deduplication and in-session speed
// HTTP browser cache handles persistence across sessions
let cachedSlidesPromise: Promise<VirtualSlide[]> | null = null;
let cachedSlides: VirtualSlide[] | null = null;

// Pre-computed search index for faster lookups
interface SearchIndexEntry {
  slide: VirtualSlide;
  diagnosisLower: string;
  diagnosisTokens: string[];
  diagnosisAcronym: string;
}

let searchIndex: SearchIndexEntry[] | null = null;

// Minimal client-entry type coming from CDN JSON
interface ClientEntry {
  id: string;
  diagnosis: string;
  category: string;
  subcategory: string;
  acr?: string;
  patient_info?: string;
  age?: string | null;
  gender?: string | null;
  clinical_history?: string;
  stain_type?: string;
  preview_image_url?: string;
  slide_url?: string;
  case_url?: string;
  other_urls?: string[];
}

function normalizeToVirtualSlide(e: ClientEntry): VirtualSlide {
  return {
    id: e.id,
    repository: getRepositoryFromId(e.id),
    category: e.category || "",
    subcategory: e.subcategory || "",
    diagnosis: e.diagnosis || "",
    patient_info: e.patient_info || "",
    age: e.age ?? null,
    gender: e.gender ?? null,
    clinical_history: e.clinical_history || "",
    stain_type: e.stain_type || "",
    preview_image_url: e.preview_image_url || "",
    image_url: undefined,
    slide_url: e.slide_url || "",
    case_url: e.case_url || "",
    other_urls: e.other_urls || [],
    source_metadata: {},
  };
}

async function loadClientSlides(): Promise<VirtualSlide[]> {
  // Check memory cache first (same session)
  if (cachedSlides) {
    return Promise.resolve(cachedSlides);
  }

  // If already fetching, return the existing promise (deduplication)
  if (cachedSlidesPromise) return cachedSlidesPromise;

  const { VIRTUAL_SLIDES_JSON_URL } = await import("@/shared/config/virtual-slides");

  async function fetchWithFallback() {
    const fetchWithTimeout = async (
      input: RequestInfo | URL,
      init?: RequestInit & { timeoutMs?: number }
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
      try {
        const res = await fetch(input, { ...init, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      const res = await fetchWithTimeout(VIRTUAL_SLIDES_JSON_URL, {
        cache: "force-cache",
        timeoutMs: 8000,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res;
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? "Timed out fetching virtual slides. Please check your network and try again."
          : e?.message || "Failed to fetch virtual slides dataset.";

      if (process.env.NODE_ENV === "production") {
        console.error(
          "[VirtualSlides] R2 fetch failed in production. Check R2 CORS and network.",
          e
        );
        throw new Error(msg);
      }
      console.warn(
        "[VirtualSlides] R2 fetch failed in dev, falling back to /api/public/data/virtual-slides"
      );
      return await fetchWithTimeout("/api/public/data/virtual-slides", {
        cache: "force-cache",
        timeoutMs: 8000,
      });
    }
  }

  cachedSlidesPromise = fetchWithFallback().then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch client slides: ${res.status}`);
    const json = await res.json();
    const entries: ClientEntry[] = Array.isArray(json) ? json : (json.data ?? []);
    const slides = entries.map(normalizeToVirtualSlide);

    // Store in memory for session (HTTP cache handles persistence)
    cachedSlides = slides;

    // Pre-compute search index for faster lookups
    searchIndex = slides.map((slide) => {
      const diagnosisLower = (slide.diagnosis || "").toLowerCase();
      const diagnosisTokens = tokenize(diagnosisLower);
      const diagnosisAcronym = makeAcr(diagnosisTokens);

      return {
        slide,
        diagnosisLower,
        diagnosisTokens,
        diagnosisAcronym,
      };
    });

    console.log(
      `[VirtualSlides Enhanced] 💾 Cached ${slides.length} slides + search index in memory`
    );

    return slides;
  });

  return cachedSlidesPromise;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cache compiled regex patterns to avoid recreating them in tight loops
const regexCache = new Map<string, RegExp>();
const MAX_REGEX_CACHE_SIZE = 500;

function getWordBoundaryRegex(term: string): RegExp {
  const cacheKey = `wb:${term}`;
  let regex = regexCache.get(cacheKey);

  if (!regex) {
    regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");

    // Prevent unbounded cache growth
    if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
      // Clear oldest half when limit reached
      const keysToDelete = Array.from(regexCache.keys()).slice(0, MAX_REGEX_CACHE_SIZE / 2);
      keysToDelete.forEach((k) => regexCache.delete(k));
    }

    regexCache.set(cacheKey, regex);
  }

  return regex;
}

function isCompleteWordMatch(text: string, term: string): boolean {
  if (!term) return false;
  const regex = getWordBoundaryRegex(term);
  return regex.test(text);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function makeAcr(words: string[]): string {
  return words.map((w) => w[0]).join("");
}

// Expand medical acronyms in a query
// e.g., "papillary rcc" → ["papillary rcc", "papillary renal cell carcinoma"]
// e.g., "renal aml" → ["renal aml", "renal angiomyolipoma", "renal acute myeloid leukemia"]
function expandMedicalAcronyms(query: string): string[] {
  const terms = [query]; // Always include original query
  const words = query.toLowerCase().split(/\s+/);

  // Check each word for acronym expansion
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const expansion = MEDICAL_ACRONYMS[word];

    if (expansion) {
      // Handle both single expansions and multiple expansions (array)
      const expansions = Array.isArray(expansion) ? expansion : [expansion];

      for (const exp of expansions) {
        // Create expanded version by replacing the acronym
        const expandedWords = [...words];
        expandedWords[i] = exp;
        terms.push(expandedWords.join(" "));
      }
    }
  }

  return terms;
}

// Helper to rank slides by a single term with optional organ context
// OPTIMIZED: Uses pre-computed search index to avoid repeated tokenization
function rankSlidesByTerm(
  slides: VirtualSlide[],
  term: string,
  organContext?: OrganTerm[]
): Map<string, { slide: VirtualSlide; bucketIndex: number; organBoost: number }> {
  const termLower = term.toLowerCase().trim();
  const words = tokenize(termLower);
  const last = words[words.length - 1];
  const usePrefix = last && last.length >= 4;
  const acr = words.length >= 2 ? makeAcr(words) : "";

  // For multi-word queries, find the longest word that's NOT a common medical term
  // e.g., "renal angiomyolipoma" → "angiomyolipoma" (specific)
  // but "renal cell carcinoma" → none ("carcinoma" is blacklisted)
  const specificWord =
    words.length > 1
      ? words.filter((w) => !COMMON_MEDICAL_TERMS.has(w)).sort((a, b) => b.length - a.length)[0]
      : "";

  const rankedSlides = new Map<
    string,
    { slide: VirtualSlide; bucketIndex: number; organBoost: number }
  >();

  // Use pre-computed search index if available, otherwise fall back to slides
  const entries =
    searchIndex ||
    slides.map((s) => ({
      slide: s,
      diagnosisLower: (s.diagnosis || "").toLowerCase(),
      diagnosisTokens: tokenize((s.diagnosis || "").toLowerCase()),
      diagnosisAcronym: makeAcr(tokenize((s.diagnosis || "").toLowerCase())),
    }));

  for (const entry of entries) {
    const { slide: s, diagnosisLower: d, diagnosisTokens, diagnosisAcronym } = entry;
    if (!d) continue;

    let bucketIndex = -1;

    // Bucket 1: exact equality on diagnosis
    if (d === termLower) {
      bucketIndex = 1;
    }
    // Bucket 2: exact phrase with word boundaries (highest priority for multi-word)
    // e.g., "renal cell carcinoma" finds "clear cell renal cell carcinoma" but NOT "spindle cell carcinoma"
    else if (isCompleteWordMatch(d, termLower)) {
      bucketIndex = 2;
    }
    // Bucket 3: specific (non-common) word for multi-word queries
    // e.g., "renal angiomyolipoma" → matches "angiomyolipoma" alone (not in blacklist)
    // but "renal cell carcinoma" → does NOT match any single word ("carcinoma" is blacklisted)
    else if (specificWord && specificWord.length >= 5 && isCompleteWordMatch(d, specificWord)) {
      bucketIndex = 3;
    }
    // Bucket 4: acronym match (use pre-computed acronym)
    else if (
      (acr && acr === diagnosisAcronym) ||
      (termLower.length >= 2 && termLower.length <= 5 && termLower === diagnosisAcronym)
    ) {
      bucketIndex = 4;
    }
    // Bucket 5 & 6: ONLY for single-word queries
    else if (words.length === 1) {
      const singleWord = words[0];
      // Bucket 5: single word match (≥4 chars)
      if (singleWord.length >= 4 && isCompleteWordMatch(d, singleWord)) {
        bucketIndex = 5;
      }
      // Bucket 6: prefix match on single word (use pre-computed tokens)
      else if (usePrefix && diagnosisTokens.some((w) => w.startsWith(singleWord))) {
        bucketIndex = 6;
      }
    }
    // Bucket 7+: REMOVED for multi-word queries - too much noise

    if (bucketIndex >= 0) {
      const slideKey = s.id || s.diagnosis || Math.random().toString();

      // Calculate organ context boost
      const organBoost = organContext ? getOrganBoostScore(s, organContext) : 1.0;

      const existing = rankedSlides.get(slideKey);

      // Keep the best (lowest) bucket index for each slide, with organ boost
      if (
        !existing ||
        bucketIndex < existing.bucketIndex ||
        (bucketIndex === existing.bucketIndex && organBoost > existing.organBoost)
      ) {
        rankedSlides.set(slideKey, { slide: s, bucketIndex, organBoost });
      }
    }
  }

  return rankedSlides;
}

// Search mode types
export type SearchMode = "standard" | "nci-fallback";

// Minimum score threshold to consider a result "good quality"
const GOOD_RESULT_THRESHOLD = 2; // Bucket 2 or better (exact phrase matches)
const MIN_GOOD_RESULTS = 5; // Minimum number of good results before considering NCI fallback

// Main ranking function with optional NCI fallback
async function rankSlidesWithExpansion(
  slides: VirtualSlide[],
  query: string,
  searchMode: SearchMode = "standard"
): Promise<{
  slides: VirtualSlide[];
  expandedTerms: string[];
  method?: string;
  confidence?: number;
}> {
  const term = (query || "").toLowerCase().trim();
  if (!term) return { slides, expandedTerms: [] };

  // Step 1: Expand medical acronyms (e.g., "papillary rcc" → ["papillary rcc", "papillary renal cell carcinoma"])
  const expandedQueries = expandMedicalAcronyms(term);

  // Extract organ/anatomical context from original query
  const { organs } = extractOrganTerms(query);

  // Step 2: Search across all expanded queries and aggregate results
  const aggregatedRankings = new Map<
    string,
    { slide: VirtualSlide; bucketIndex: number; organBoost: number }
  >();

  for (const searchTerm of expandedQueries) {
    const termRankings = rankSlidesByTerm(
      slides,
      searchTerm,
      organs.length > 0 ? organs : undefined
    );

    for (const [slideKey, { slide, bucketIndex, organBoost }] of termRankings.entries()) {
      const existing = aggregatedRankings.get(slideKey);

      // Keep the best (lowest) bucket index across all expansions
      if (
        !existing ||
        bucketIndex < existing.bucketIndex ||
        (bucketIndex === existing.bucketIndex && organBoost > existing.organBoost)
      ) {
        aggregatedRankings.set(slideKey, { slide, bucketIndex, organBoost });
      }
    }
  }

  const standardRankings = aggregatedRankings;

  // Count good quality results (bucket 3 or better)
  const goodResults = Array.from(standardRankings.values()).filter(
    ({ bucketIndex }) => bucketIndex <= GOOD_RESULT_THRESHOLD
  );

  // Step 2: If we have enough good results, return them
  if (goodResults.length >= MIN_GOOD_RESULTS || searchMode === "standard") {
    const sortedSlides = Array.from(standardRankings.values())
      .sort((a, b) => {
        if (a.bucketIndex !== b.bucketIndex) {
          return a.bucketIndex - b.bucketIndex;
        }
        return b.organBoost - a.organBoost;
      })
      .map((item) => item.slide);

    return {
      slides: sortedSlides,
      expandedTerms: [],
      method: "standard",
    };
  }

  // Step 3: Fall back to NCI expansion for better results
  const nciExpandedTerms = await expandSearchTermClient(term);

  // Aggregate NCI rankings across all expanded terms with organ context
  const nciRankings = new Map<
    string,
    { slide: VirtualSlide; bucketIndex: number; organBoost: number }
  >();

  for (const searchTermItem of nciExpandedTerms) {
    const termRankings = rankSlidesByTerm(
      slides,
      searchTermItem,
      organs.length > 0 ? organs : undefined
    );

    for (const [slideKey, { slide, bucketIndex, organBoost }] of termRankings.entries()) {
      const existing = nciRankings.get(slideKey);

      // Keep the best (lowest) bucket index, or same bucket with higher organ boost
      if (
        !existing ||
        bucketIndex < existing.bucketIndex ||
        (bucketIndex === existing.bucketIndex && organBoost > existing.organBoost)
      ) {
        nciRankings.set(slideKey, { slide, bucketIndex, organBoost });
      }
    }
  }

  // Sort by bucket index (best matches first), then by organ boost (highest first)
  const sortedSlides = Array.from(nciRankings.values())
    .sort((a, b) => {
      if (a.bucketIndex !== b.bucketIndex) {
        return a.bucketIndex - b.bucketIndex;
      }
      // Within same bucket, prioritize organ matches
      return b.organBoost - a.organBoost;
    })
    .map((item) => item.slide);

  return {
    slides: sortedSlides,
    expandedTerms: nciExpandedTerms.slice(1), // Exclude original term
    method: "nci-fallback",
  };
}

export interface ClientSearchOptions {
  query?: string;
  repository?: string;
  category?: string;
  subcategory?: string;
  randomMode?: boolean;
  randomSeed?: number;
  page?: number;
  limit?: number;
  searchMode?: SearchMode; // Control search strategy (standard or nci-fallback)
}

export function useClientVirtualSlidesEnhanced(defaultLimit: number = 20) {
  const [allSlides, setAllSlides] = useState<VirtualSlide[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false); // Separate state for search operations
  const [error, setError] = useState<string | null>(null);
  const [expandedSearchTerms, setExpandedSearchTerms] = useState<string[]>([]);
  const [searchMethod, setSearchMethod] = useState<string | undefined>();
  const [searchConfidence, setSearchConfidence] = useState<number | undefined>();

  const [options, setOptions] = useState<ClientSearchOptions>({
    page: 1,
    limit: defaultLimit,
    searchMode: "standard",
  });

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadClientSlides()
      .then((slides) => {
        if (mounted) setAllSlides(slides);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load slides");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const repositories = useMemo(() => {
    if (!allSlides) return [];
    return Array.from(new Set(allSlides.map((s) => (s.repository || "").toString().trim())))
      .filter((val) => val.length > 0)
      .sort();
  }, [allSlides]);

  const categories = useMemo(() => {
    if (!allSlides) return [];
    return Array.from(new Set(allSlides.map((s) => (s.category || "").toString().trim())))
      .filter((val) => val.length > 0)
      .sort();
  }, [allSlides]);

  const organSystems = useMemo(() => {
    if (!allSlides) return [];
    return Array.from(new Set(allSlides.map((s) => (s.subcategory || "").toString().trim())))
      .filter((val) => val.length > 0)
      .sort();
  }, [allSlides]);

  const [filteredAndRanked, setFilteredAndRanked] = useState<VirtualSlide[]>([]);

  // Handle filtering and ranking with configurable search mode
  useEffect(() => {
    if (!allSlides) {
      setFilteredAndRanked([]);
      return;
    }

    let mounted = true;

    async function processSlides() {
      // Show searching indicator for operations that might take time
      const hasQuery = options.query && options.query.trim();
      if (hasQuery) {
        setIsSearching(true);
      }

      try {
        let list = allSlides;
        // Filters first
        if (options.repository && options.repository !== "all") {
          list = list.filter((s) => s.repository === options.repository);
        }
        if (options.category && options.category !== "all") {
          list = list.filter((s) => s.category === options.category);
        }
        if (options.subcategory && options.subcategory !== "all") {
          list = list.filter((s) => s.subcategory === options.subcategory);
        }

        // Random mode
        if (options.randomMode) {
          const seedBase = options.randomSeed ?? Date.now();
          const seed = (options.page || 1) * 1337 + seedBase;
          const rng = (n: number) => {
            const x = Math.sin(seed + n) * 10000;
            return x - Math.floor(x);
          };
          let arr = list.slice();
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng(i) * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          // Use the limit from options, or default to showing all
          const randomLimit = options.limit ?? arr.length;
          if (arr.length > randomLimit) arr = arr.slice(0, randomLimit);
          if (mounted) {
            setFilteredAndRanked(arr);
            setExpandedSearchTerms([]);
          }
          return;
        }

        // Search with configurable mode
        if (hasQuery) {
          const mode = options.searchMode || "standard";
          const {
            slides: rankedSlides,
            expandedTerms,
            method,
            confidence,
          } = await rankSlidesWithExpansion(list, options.query, mode);
          if (mounted) {
            setFilteredAndRanked(rankedSlides);
            setExpandedSearchTerms(expandedTerms);
            setSearchMethod(method);
            setSearchConfidence(confidence);
          }
        } else {
          if (mounted) {
            setFilteredAndRanked(list);
            setExpandedSearchTerms([]);
            setSearchMethod(undefined);
            setSearchConfidence(undefined);
          }
        }
      } finally {
        if (mounted && hasQuery) {
          setIsSearching(false);
        }
      }
    }

    processSlides();

    return () => {
      mounted = false;
    };
  }, [allSlides, options]);

  const total = filteredAndRanked.length;
  const page = options.page || 1;
  const limit = options.limit || defaultLimit;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const end = Math.min(start + limit, total);
  const pageSlides = filteredAndRanked.slice(start, end);

  // API-like controls
  const searchWithFilters = useCallback(
    async (opts: ClientSearchOptions) => {
      setOptions((prev) => {
        const next: ClientSearchOptions = { ...prev };
        if (Object.prototype.hasOwnProperty.call(opts, "page")) next.page = opts.page;
        else if (!prev.page) next.page = 1;
        if (Object.prototype.hasOwnProperty.call(opts, "limit"))
          next.limit = opts.limit ?? prev.limit ?? defaultLimit;

        if (Object.prototype.hasOwnProperty.call(opts, "query")) next.query = opts.query;
        if (Object.prototype.hasOwnProperty.call(opts, "repository"))
          next.repository = opts.repository;
        if (Object.prototype.hasOwnProperty.call(opts, "category")) next.category = opts.category;
        if (Object.prototype.hasOwnProperty.call(opts, "subcategory"))
          next.subcategory = opts.subcategory;

        if (Object.prototype.hasOwnProperty.call(opts, "randomMode"))
          next.randomMode = opts.randomMode ?? false;
        if (Object.prototype.hasOwnProperty.call(opts, "randomSeed"))
          next.randomSeed = opts.randomSeed;

        if (Object.prototype.hasOwnProperty.call(opts, "searchMode")) {
          next.searchMode = opts.searchMode;
        }

        if (next.limit == null) next.limit = prev.limit ?? defaultLimit;
        if (next.page == null) next.page = 1;
        if (next.searchMode == null) next.searchMode = "standard"; // Default to standard mode for speed
        return next;
      });
    },
    [defaultLimit]
  );

  const search = useCallback(
    async (query: string, page: number = 1) => {
      await searchWithFilters({ query, page });
    },
    [searchWithFilters]
  );

  const nextPage = useCallback(async () => {
    if (page < totalPages) setOptions((prev) => ({ ...prev, page: (prev.page || 1) + 1 }));
  }, [page, totalPages]);

  const previousPage = useCallback(async () => {
    if (page > 1) setOptions((prev) => ({ ...prev, page: (prev.page || 1) - 1 }));
  }, [page]);

  const goToPage = useCallback(
    async (p: number) => {
      const clamped = Math.min(Math.max(1, p), totalPages);
      setOptions((prev) => ({ ...prev, page: clamped }));
    },
    [totalPages]
  );

  return {
    // Data
    slides: pageSlides,
    isLoading: isLoading || isSearching, // Combine loading states for UI
    error,

    // Pagination
    currentPage: page,
    totalPages,
    totalResults: total,

    // Actions
    search,
    searchWithFilters,
    nextPage,
    previousPage,
    goToPage,

    // Metadata
    totalSlides: allSlides?.length || 0,
    repositories,
    categories,
    organSystems,

    // Search expansion info
    expandedSearchTerms,
    searchMethod,
    searchConfidence,

    currentSearchOptions: options,
  };
}
