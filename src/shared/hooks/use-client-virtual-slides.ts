"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRepositoryFromId } from "@/shared/utils/repository";
import { toast } from "@/shared/utils/toast";

// Module-scope cache so we only fetch once per session
let cachedSlidesPromise: Promise<VirtualSlide[]> | null = null;

// Minimal client-entry type coming from CDN JSON
// Note: repository omitted (derived), title omitted (same as diagnosis)
interface ClientEntry {
  id: string;
  diagnosis: string;
  category: string;
  subcategory: string;
  acr?: string;
  // Optional additional fields for UI rendering
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

      // In production, do NOT fall back to Vercel proxy to avoid bandwidth/invocations.
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[VirtualSlides] R2 fetch failed in production. Check R2 CORS and network.",
          e
        );
        throw new Error(msg);
      }
      // In development, fallback to local proxy to ease testing when R2 CORS is not configured.
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
    // Support both array and wrapped formats
    const entries: ClientEntry[] = Array.isArray(json) ? json : (json.data ?? []);
    return entries.map(normalizeToVirtualSlide);
  });

  return cachedSlidesPromise;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCompleteWordMatch(text: string, term: string): boolean {
  if (!term) return false;
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  return regex.test(text);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function makeAcr(words: string[]): string {
  return words.map((w) => w[0]).join("");
}

// Helper to rank slides by a single term
function rankSlidesByTerm(
  slides: VirtualSlide[],
  term: string
): Map<string, { slide: VirtualSlide; bucketIndex: number }> {
  const termLower = term.toLowerCase().trim();
  const words = tokenize(termLower);
  const last = words[words.length - 1];
  const usePrefix = last && last.length >= 4;
  const text = (s: VirtualSlide) => (s.diagnosis || "").toLowerCase();
  const acr = words.length >= 2 ? makeAcr(words) : "";

  const rankedSlides = new Map<string, { slide: VirtualSlide; bucketIndex: number }>();

  for (const s of slides) {
    const d = text(s);
    if (!d) continue;

    let bucketIndex = -1;

    // Bucket 1: exact equality on diagnosis
    if (d === termLower) {
      bucketIndex = 1;
    }
    // Bucket 2: word-boundary phrase
    else if (isCompleteWordMatch(d, termLower)) {
      bucketIndex = 2;
    }
    // Bucket 3: all tokens as complete words
    else if (words.length > 0 && words.every((w) => isCompleteWordMatch(d, w))) {
      bucketIndex = 3;
    }
    // Bucket 4: acronym
    else if (
      (acr && acr === makeAcr(tokenize(d))) ||
      (termLower.length >= 2 && termLower.length <= 5 && termLower === makeAcr(tokenize(d)))
    ) {
      bucketIndex = 4;
    }
    // Bucket 5: any token as complete word
    else if (words.some((w) => isCompleteWordMatch(d, w))) {
      bucketIndex = 5;
    }
    // Bucket 6: token prefix on last token
    else if (usePrefix && tokenize(d).some((w) => w.startsWith(last))) {
      bucketIndex = 6;
    }
    // Bucket 7: substring fallback
    else if (d.includes(termLower)) {
      bucketIndex = 7;
    }

    if (bucketIndex > 0) {
      const slideKey = s.id || s.diagnosis || Math.random().toString();
      const existing = rankedSlides.get(slideKey);

      // Keep the best (lowest) bucket index for each slide
      if (!existing || bucketIndex < existing.bucketIndex) {
        rankedSlides.set(slideKey, { slide: s, bucketIndex });
      }
    }
  }

  return rankedSlides;
}

// Simple ranking function (no expansion)
function rankSlides(slides: VirtualSlide[], query: string): VirtualSlide[] {
  const term = (query || "").toLowerCase().trim();
  if (!term) return slides;

  const rankings = rankSlidesByTerm(slides, term);

  return Array.from(rankings.values())
    .sort((a, b) => a.bucketIndex - b.bucketIndex)
    .map((item) => item.slide);
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
  searchMode?: "standard" | "nci-fallback"; // Control search strategy
}

export function useClientVirtualSlides(defaultLimit: number = 20) {
  const [allSlides, setAllSlides] = useState<VirtualSlide[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSearchTerms, setExpandedSearchTerms] = useState<string[]>([]);

  const [options, setOptions] = useState<ClientSearchOptions>({ page: 1, limit: defaultLimit });

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadClientSlides()
      .then((slides) => {
        if (mounted) setAllSlides(slides);
      })
      .catch((err) => {
        if (mounted) {
          const errorMessage = err.message || "Failed to load slides";
          setError(errorMessage);

          // Detect network errors (laptop sleep/wake, offline, etc.)
          const isNetworkError =
            err instanceof TypeError &&
            (err.message?.includes("fetch") || err.message?.includes("network"));

          if (isNetworkError) {
            toast.error("Network connection interrupted. Please refresh the page.");
          } else if (err.message?.includes("Timed out")) {
            toast.error("Request timed out. Please check your network connection.");
          } else {
            toast.error(errorMessage);
          }
        }
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

  // Handle filtering and ranking with async NCI EVS expansion
  useEffect(() => {
    if (!allSlides) {
      setFilteredAndRanked([]);
      return;
    }

    let mounted = true;

    async function processSlides() {
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

      // Random mode: shuffle deterministically per page when enabled, ignoring query ranking
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
        // In random mode, always show a small random sample of 10
        if (arr.length > 10) arr = arr.slice(0, 10);
        if (mounted) {
          setFilteredAndRanked(arr);
          setExpandedSearchTerms([]);
        }
        return;
      }

      // Ranking search
      if (options.query && options.query.trim()) {
        const rankedSlides = rankSlides(list, options.query);
        if (mounted) {
          setFilteredAndRanked(rankedSlides);
          setExpandedSearchTerms([]);
        }
      } else {
        if (mounted) {
          setFilteredAndRanked(list);
          setExpandedSearchTerms([]);
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
        const next = { ...prev } as unknown;
        // page and limit: apply if provided, else keep existing (default at init)
        if (Object.prototype.hasOwnProperty.call(opts, "page")) next.page = opts.page;
        else if (!prev.page) next.page = 1;
        if (Object.prototype.hasOwnProperty.call(opts, "limit"))
          next.limit = opts.limit ?? prev.limit ?? defaultLimit;

        // query and filters: apply even if undefined to allow clearing
        if (Object.prototype.hasOwnProperty.call(opts, "query")) next.query = opts.query;
        if (Object.prototype.hasOwnProperty.call(opts, "repository"))
          next.repository = opts.repository;
        if (Object.prototype.hasOwnProperty.call(opts, "category")) next.category = opts.category;
        if (Object.prototype.hasOwnProperty.call(opts, "subcategory"))
          next.subcategory = opts.subcategory;

        // random mode + seed
        if (Object.prototype.hasOwnProperty.call(opts, "randomMode"))
          next.randomMode = opts.randomMode ?? false;
        if (Object.prototype.hasOwnProperty.call(opts, "randomSeed"))
          next.randomSeed = opts.randomSeed;

        // search mode control
        if (Object.prototype.hasOwnProperty.call(opts, "searchMode"))
          next.searchMode = opts.searchMode;

        // Defaults
        if (next.limit == null) next.limit = prev.limit ?? defaultLimit;
        if (next.page == null) next.page = 1;
        if (next.searchMode == null) next.searchMode = "nci-fallback";
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
    isLoading,
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

    // NCI EVS expansion
    expandedSearchTerms,

    currentSearchOptions: options,
  };
}
