"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRepositoryFromId } from "@/shared/utils/repository";
import { expandSearchTermClient } from "@/shared/utils/nci-evs-client";
import { extractOrganTerms, getOrganBoostScore, type OrganTerm } from "@/shared/utils/organ-terms";
import { MEDICAL_ACRONYMS } from "@/shared/utils/medical-acronyms";

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

// Reverse index: word → Set of slide indices
// This allows us to check ONLY relevant slides instead of ALL slides
let reverseIndex: Map<string, Set<number>> | null = null;

// ============================================================================
// LEGACY FORMAT SUPPORT (DEPRECATED - Remove after July 2026)
// ============================================================================
// This interface supports the old virtual-slides.json format (11MB).
// The optimized format (v2.0, 7.4MB) is now the default.
// Legacy file is kept as backup but can be removed after July 2026.
// TODO: Remove this interface and all legacy format code after July 2026
// ============================================================================
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

// Optimized format (v2.0)
interface OptimizedEntry {
  i: string; // id
  d: string; // diagnosis
  c: string; // category
  s: string; // subcategory
  a?: string; // acr
  p?: string; // patient_info
  ag?: string | null; // age
  g?: string; // gender
  h?: string; // clinical_history
  st?: string; // stain_type
  pv?: string; // preview_image_url
  b?: number; // base_index
  u?: string; // url_path or full url
  cu?: string; // case_url
  o?: string[]; // other_urls
}

interface OptimizedData {
  version: string;
  bases: string[];
  data: OptimizedEntry[];
}

// URL bases cache for optimized format
let urlBases: string[] | null = null;

function normalizeToVirtualSlide(
  e: ClientEntry | OptimizedEntry,
  isOptimized: boolean = false
): VirtualSlide {
  if (isOptimized) {
    const opt = e as OptimizedEntry;

    // Reconstruct slide_url from base + path
    let slideUrl = opt.u || "";
    if (opt.b !== undefined && urlBases && urlBases[opt.b]) {
      slideUrl = urlBases[opt.b] + (opt.u || "");
    }

    return {
      id: opt.i,
      repository: getRepositoryFromId(opt.i),
      category: opt.c || "",
      subcategory: opt.s || "",
      diagnosis: opt.d || "",
      patient_info: opt.p || "",
      age: opt.ag ?? null,
      gender: opt.g ?? null,
      clinical_history: opt.h || "",
      stain_type: opt.st || "",
      preview_image_url: opt.pv || "",
      image_url: undefined,
      slide_url: slideUrl,
      case_url: opt.cu || "",
      other_urls: opt.o || [],
      source_metadata: {},
    };
  } else {
    // DEPRECATED: Legacy format support (Remove after July 2026)
    // This handles the old virtual-slides.json format for backward compatibility
    const legacy = e as ClientEntry;
    return {
      id: legacy.id,
      repository: getRepositoryFromId(legacy.id),
      category: legacy.category || "",
      subcategory: legacy.subcategory || "",
      diagnosis: legacy.diagnosis || "",
      patient_info: legacy.patient_info || "",
      age: legacy.age ?? null,
      gender: legacy.gender ?? null,
      clinical_history: legacy.clinical_history || "",
      stain_type: legacy.stain_type || "",
      preview_image_url: legacy.preview_image_url || "",
      image_url: undefined,
      slide_url: legacy.slide_url || "",
      case_url: legacy.case_url || "",
      other_urls: legacy.other_urls || [],
      source_metadata: {},
    };
  }
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
        "[VirtualSlides] R2 fetch failed in dev, falling back to /api/public/tools/virtual-slides"
      );
      return await fetchWithTimeout("/api/public/tools/virtual-slides", {
        cache: "force-cache",
        timeoutMs: 8000,
      });
    }
  }

  cachedSlidesPromise = fetchWithFallback().then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch client slides: ${res.status}`);
    const json = await res.json();

    // Detect format: optimized (v2.0) or legacy
    const isOptimized = json.version && json.bases && json.data;

    let entries: (ClientEntry | OptimizedEntry)[];
    let slides: VirtualSlide[];

    if (isOptimized) {
      // Optimized format (v2.0) - Default format
      const optimized = json as OptimizedData;
      urlBases = optimized.bases; // Cache URL bases
      entries = optimized.data;
      slides = entries.map((e) => normalizeToVirtualSlide(e, true));
      console.log(`[VirtualSlides] Loaded optimized format v${optimized.version}`);
    } else {
      // DEPRECATED: Legacy format support (Remove after July 2026)
      // This handles the old virtual-slides.json format for backward compatibility
      // Users on old app versions can still access the legacy file
      entries = Array.isArray(json) ? json : (json.data ?? []);
      slides = entries.map((e) => normalizeToVirtualSlide(e as ClientEntry, false));
      console.log("[VirtualSlides] Loaded legacy format (deprecated, remove after July 2026)");
    }

    // Store in memory for session (HTTP cache handles persistence)
    cachedSlides = slides;

    // Pre-compute search index AND reverse index for O(1) lookups
    searchIndex = [];
    reverseIndex = new Map();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const diagnosisLower = (slide.diagnosis || "").toLowerCase();
      const diagnosisTokens = tokenize(diagnosisLower);
      const diagnosisAcronym = makeAcr(diagnosisTokens);

      searchIndex.push({
        slide,
        diagnosisLower,
        diagnosisTokens,
        diagnosisAcronym,
      });

      // Build reverse index: each word → set of slide indices
      for (const token of diagnosisTokens) {
        if (!reverseIndex.has(token)) {
          reverseIndex.set(token, new Set());
        }
        reverseIndex.get(token)!.add(i);

        // Also index prefixes (3+ chars) for prefix matching
        if (token.length >= 4) {
          const prefix = token.substring(0, 3);
          const prefixKey = `prefix:${prefix}`;
          if (!reverseIndex.has(prefixKey)) {
            reverseIndex.set(prefixKey, new Set());
          }
          reverseIndex.get(prefixKey)!.add(i);
        }
      }

      // Index acronyms too
      if (diagnosisAcronym.length >= 2) {
        const acrKey = `acr:${diagnosisAcronym}`;
        if (!reverseIndex.has(acrKey)) {
          reverseIndex.set(acrKey, new Set());
        }
        reverseIndex.get(acrKey)!.add(i);
      }
    }

    console.log(
      `[VirtualSlides Enhanced] 💾 Cached ${slides.length} slides + reverse index (${reverseIndex.size} keys) in memory`
    );

    return slides;
  });

  return cachedSlidesPromise;
}

// Simple helper functions for tokenization

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

// HIGHLY OPTIMIZED: Uses reverse index to check ONLY relevant slides
function rankSlidesByTerm(
  slides: VirtualSlide[],
  term: string,
  organContext?: OrganTerm[],
  _maxResults: number = 150 // Reduced from 200 for even better performance
): Map<string, { slide: VirtualSlide; score: number }> {
  const termLower = term.toLowerCase().trim();
  const words = tokenize(termLower);

  if (!searchIndex || !reverseIndex) {
    // Fallback if indices not ready
    return new Map();
  }

  const rankedSlides = new Map<string, { slide: VirtualSlide; score: number }>();

  // Step 1: Find ALL candidate slide indices using reverse index
  const candidateIndices = new Set<number>();

  // Add slides that contain ANY word from the query
  for (const word of words) {
    if (word.length >= 3) {
      const indices = reverseIndex.get(word);
      if (indices) {
        indices.forEach((idx) => candidateIndices.add(idx));
      }

      // Also check prefixes for single-word queries
      if (words.length === 1 && word.length >= 3) {
        const prefix = word.substring(0, 3);
        const prefixIndices = reverseIndex.get(`prefix:${prefix}`);
        if (prefixIndices) {
          prefixIndices.forEach((idx) => candidateIndices.add(idx));
        }
      }
    }
  }

  // Also add acronym matches
  if (words.length >= 2) {
    const acr = makeAcr(words);
    const acrIndices = reverseIndex.get(`acr:${acr}`);
    if (acrIndices) {
      acrIndices.forEach((idx) => candidateIndices.add(idx));
    }
  }

  // Early exit if no candidates found
  if (candidateIndices.size === 0) {
    return rankedSlides;
  }

  // Step 2: Score ONLY the candidate slides (much smaller set!)
  for (const idx of candidateIndices) {
    const entry = searchIndex[idx];
    const { slide: s, diagnosisLower: d, diagnosisTokens, diagnosisAcronym } = entry;
    if (!d) continue;

    let score = 0;

    // Score 100: exact match
    if (d === termLower) {
      score = 100;
    }
    // Score 90: contains exact phrase
    else if (d.includes(termLower)) {
      score = 90;
    }
    // Score 70-80: word-level matches
    else {
      let matchedWords = 0;
      for (const word of words) {
        if (word.length >= 3 && diagnosisTokens.includes(word)) {
          matchedWords++;
        }
      }

      if (matchedWords > 0) {
        score = 70 + (matchedWords / words.length) * 10;
      }
      // Score 60: acronym match
      else if (words.length >= 2 && makeAcr(words) === diagnosisAcronym) {
        score = 60;
      }
      // Score 50: prefix match
      else if (words.length === 1 && words[0].length >= 3) {
        if (diagnosisTokens.some((w) => w.startsWith(words[0]))) {
          score = 50;
        }
      }
    }

    if (score > 0) {
      const slideKey = s.id || s.diagnosis || Math.random().toString();

      // Apply organ context boost
      if (organContext && organContext.length > 0) {
        const organBoost = getOrganBoostScore(s, organContext);
        score *= organBoost;
      }

      rankedSlides.set(slideKey, { slide: s, score });
    }
  }

  return rankedSlides;
}

// Search mode types
export type SearchMode = "standard" | "nci-fallback";

// Minimum score threshold to consider a result "good quality"
const MIN_GOOD_RESULTS = 5; // Minimum number of good results before considering NCI fallback

// Simplified main ranking function with optional NCI fallback
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
  const aggregatedRankings = new Map<string, { slide: VirtualSlide; score: number }>();

  for (const searchTerm of expandedQueries) {
    const termRankings = rankSlidesByTerm(
      slides,
      searchTerm,
      organs.length > 0 ? organs : undefined,
      150 // Limit per term for better performance
    );

    for (const [slideKey, { slide, score }] of termRankings.entries()) {
      const existing = aggregatedRankings.get(slideKey);

      // Keep the best (highest) score across all expansions
      if (!existing || score > existing.score) {
        aggregatedRankings.set(slideKey, { slide, score });
      }
    }
  }

  const standardRankings = aggregatedRankings;

  // Count good quality results (score >= 70)
  const goodResults = Array.from(standardRankings.values()).filter(({ score }) => score >= 70);

  // If we have enough good results OR standard mode, return immediately
  if (goodResults.length >= MIN_GOOD_RESULTS || searchMode === "standard") {
    const sortedSlides = Array.from(standardRankings.values())
      .sort((a, b) => b.score - a.score) // Higher scores first
      .map((item) => item.slide);

    return {
      slides: sortedSlides,
      expandedTerms: [],
      method: "standard",
    };
  }

  // Step 3: Fall back to NCI expansion ONLY if few results
  const nciExpandedTerms = await expandSearchTermClient(term);

  // Aggregate NCI rankings across all expanded terms with organ context
  const nciRankings = new Map<string, { slide: VirtualSlide; score: number }>();

  for (const searchTermItem of nciExpandedTerms) {
    const termRankings = rankSlidesByTerm(
      slides,
      searchTermItem,
      organs.length > 0 ? organs : undefined,
      150 // Limit per term for better performance
    );

    for (const [slideKey, { slide, score }] of termRankings.entries()) {
      const existing = nciRankings.get(slideKey);

      // Keep the best (highest) score
      if (!existing || score > existing.score) {
        nciRankings.set(slideKey, { slide, score });
      }
    }
  }

  // Sort by score (highest first)
  const sortedSlides = Array.from(nciRankings.values())
    .sort((a, b) => b.score - a.score)
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
