"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRepositoryFromId } from "@/shared/utils/domain/repository";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "@/shared/utils/domain/virtual-slide-search";

// Module-scope cache for request deduplication and in-session speed
// HTTP browser cache handles persistence across sessions
let cachedSlidesPromise: Promise<VirtualSlide[]> | null = null;
let cachedSlides: VirtualSlide[] | null = null;

// Search index + ranking logic lives in ./utils/domain/virtual-slide-search.
// This hook owns loading/normalization/React state only.

// v7/v8 production dataset format — abbreviated field names.
interface V7Entry {
  x: string; // id
  d: string; // diagnosis
  c: string; // category
  s?: string; // subcategory (normalized organ system)
  i?: string; // patient_info
  q?: string | string[]; // acronym (WHO abbreviation)
  a?: string | null; // age
  g?: string; // gender
  h?: string; // clinical_history
  t?: string; // stain_type
  p?: V7UrlRef | V7UrlRef[]; // preview_image_url
  u?: V7UrlRef | V7UrlRef[]; // case_url
  w?: V7UrlRef | V7UrlRef[]; // other_urls
  k?: string; // case-group id (pair/panel) — member of a related-slides set
  lw?: number; // 1 = external page is login-walled (MGH) — hide the link, use the viewer
}

// v7 URL reference: {baseId: path} e.g., {"p2": "path/to/slide.svs"}
type V7UrlRef = Record<string, string>;

interface OptimizedData {
  version: string;
  bases: {
    preview?: Record<string, string>; // preview bases (p1, p2, etc.)
    case?: Record<string, string>; // case bases (c1, c2, etc.)
    other?: Record<string, string>; // other bases (o1, o2, etc.)
  };
  data: V7Entry[];
  groups?: Record<string, string[]>; // case-group id -> member slide ids (pair/panel)
}

// URL bases cache for optimized format
let urlBases: OptimizedData["bases"] | null = null;

// Case-group lookup (related slides). Populated once the dataset loads.
let groupMembers: Record<string, string[]> = {};
const slideById = new Map<string, VirtualSlide>();

// Resolve a slide's related siblings (same pair/panel case-group), excluding itself.
// Returns [] for slides not in a group, or whose siblings were dropped (e.g. no diagnosis).
export function getRelatedSlides(slide: VirtualSlide): VirtualSlide[] {
  if (!slide.groupId) return [];
  const ids = groupMembers[slide.groupId];
  if (!ids) return [];
  const out: VirtualSlide[] = [];
  for (const id of ids) {
    if (id === slide.id) continue;
    const s = slideById.get(id);
    if (s) out.push(s);
  }
  return out;
}

// Full case-group in its canonical order (the slide itself INCLUDED, in place). Used by the
// viewer's related panel so the list order is stable no matter which member is selected —
// selecting a sibling re-highlights in place instead of jumping it to the top.
export function getCaseGroup(slide: VirtualSlide): VirtualSlide[] {
  if (!slide.groupId) return [];
  const ids = groupMembers[slide.groupId];
  if (!ids) return [];
  const out: VirtualSlide[] = [];
  for (const id of ids) {
    const s = slideById.get(id);
    if (s) out.push(s);
  }
  return out;
}

// Helper to reverse URL mapping: {url: id} → {id: url}
function reverseMapping(mapping: Record<string, string> | undefined): Record<string, string> {
  if (!mapping) return {};
  const reversed: Record<string, string> = {};
  for (const [url, id] of Object.entries(mapping)) {
    reversed[id] = url;
  }
  return reversed;
}

// Helper to reconstruct v7 URLs from {baseId: path} format
function reconstructV7Url(
  urlRef: V7UrlRef | V7UrlRef[] | undefined,
  basesMap: Record<string, string> | undefined
): string | string[] {
  if (!urlRef || !basesMap) return Array.isArray(urlRef) ? [] : "";

  // Handle array of URL refs
  if (Array.isArray(urlRef)) {
    return urlRef
      .map((ref) => {
        const baseId = Object.keys(ref)[0];
        const path = ref[baseId];
        const baseUrl = basesMap[baseId];
        return baseUrl && path ? baseUrl + path : "";
      })
      .filter(Boolean);
  }

  // Handle single URL ref
  const baseId = Object.keys(urlRef)[0];
  const path = urlRef[baseId];
  const baseUrl = basesMap[baseId];
  return baseUrl && path ? baseUrl + path : "";
}

function normalizeToVirtualSlide(v7: V7Entry): VirtualSlide {
  // Reconstruct URLs from the {baseId: path} refs
  const previewUrls = reconstructV7Url(v7.p, urlBases?.preview);
  const caseUrls = reconstructV7Url(v7.u, urlBases?.case);
  const otherUrls = reconstructV7Url(v7.w, urlBases?.other);

  // Get primary URLs (first if array, string if single)
  const primaryPreview = Array.isArray(previewUrls) ? previewUrls[0] || "" : previewUrls;
  const primaryCase = Array.isArray(caseUrls) ? caseUrls[0] || "" : caseUrls;
  const otherUrlsArray = Array.isArray(otherUrls) ? otherUrls : otherUrls ? [otherUrls] : [];

  // LearnHaem's slide_url is a course page (no DZI in it); the tile source is derivable from
  // the preview thumbnail path: "<root>.dzi_files/0/0_0.jpg" → DZI at "<root>.dzi.dzi".
  // Lets the viewer resolve tiles while slide_url stays the human-facing course-page link.
  const tileSourceUrl =
    v7.x.startsWith("learnhaem_") && primaryPreview
      ? `${primaryPreview.split(".dzi_files")[0]}.dzi.dzi`
      : undefined;

  return {
    id: v7.x,
    repository: getRepositoryFromId(v7.x),
    category: v7.c || "",
    subcategory: v7.s || "",
    diagnosis: v7.d || "",
    acronym: v7.q, // Preserve WHO abbreviation(s)
    patient_info: v7.i || "",
    age: v7.a ?? null,
    gender: v7.g ?? null,
    clinical_history: v7.h || "",
    stain_type: v7.t || "",
    preview_image_url: primaryPreview,
    image_url: undefined,
    slide_url: primaryCase, // v7 uses case_url as primary viewer
    case_url: primaryCase,
    other_urls: otherUrlsArray,
    source_metadata: {},
    groupId: v7.k,
    loginWalled: v7.lw === 1,
    tileSourceUrl,
  };
}

async function loadClientSlides(): Promise<VirtualSlide[]> {
  // Check memory cache first (same session)
  if (cachedSlides) {
    return Promise.resolve(cachedSlides);
  }

  // If already fetching, return the existing promise (deduplication)
  if (cachedSlidesPromise) return cachedSlidesPromise;

  const { VIRTUAL_SLIDES_JSON_URL, VIRTUAL_SLIDES_JSON_URL_FALLBACK } =
    await import("@/shared/config/virtual-slides");

  // Check if URL is gzipped at the top level (before promise chain)
  // Need to check before query params (e.g., .gz?v=4)
  const isGzippedFile = VIRTUAL_SLIDES_JSON_URL.includes(".json.gz");

  async function fetchWithFallback() {
    const fetchWithTimeout = async (
      input: RequestInfo | URL,
      init?: RequestInit & { timeoutMs?: number }
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
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
      console.log("[VirtualSlides] ✅ Response OK, returning to processing...");
      return res;
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? "Timed out fetching virtual slides. Please check your network and try again."
          : e?.message || "Failed to fetch virtual slides dataset.";

      // Try non-gzipped fallback first if gzip failed
      if (VIRTUAL_SLIDES_JSON_URL.endsWith(".gz") && VIRTUAL_SLIDES_JSON_URL_FALLBACK) {
        try {
          console.warn("[VirtualSlides] Gzipped fetch failed, trying non-gzipped fallback");
          const fallbackRes = await fetchWithTimeout(VIRTUAL_SLIDES_JSON_URL_FALLBACK, {
            cache: "force-cache",
            timeoutMs: 8000,
          });
          if (fallbackRes.ok) return fallbackRes;
        } catch (fallbackError) {
          console.error("[VirtualSlides] Fallback also failed:", fallbackError);
        }
      }

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

  cachedSlidesPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch client slides: ${res.status}`);

      // Handle gzipped responses (.json.gz files)
      let json: OptimizedData;

      if (isGzippedFile) {
        if (typeof DecompressionStream !== "undefined") {
          // Use browser's native DecompressionStream API to decompress gzip
          try {
            if (!res.body) {
              throw new Error("Response body is null - cannot decompress");
            }

            const decompressedStream = res.body.pipeThrough(new DecompressionStream("gzip"));
            const decompressedResponse = new Response(decompressedStream);
            json = await decompressedResponse.json();
            console.log("[VirtualSlides] ✅ Decompressed gzipped data (832KB → 6.6MB)");
          } catch (decompressError) {
            console.error("[VirtualSlides] ❌ Decompression failed:", decompressError);

            // Try fallback to non-gzipped version
            if (VIRTUAL_SLIDES_JSON_URL_FALLBACK) {
              console.warn("[VirtualSlides] Trying fallback URL...");
              try {
                const fallbackRes = await fetch(VIRTUAL_SLIDES_JSON_URL_FALLBACK, {
                  cache: "force-cache",
                });
                if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`);
                json = await fallbackRes.json();
              } catch (fallbackError) {
                console.error("[VirtualSlides] ❌ Fallback failed:", fallbackError);
                throw new Error(
                  `Failed to load virtual slides: Decompression failed and fallback unavailable`
                );
              }
            } else {
              throw new Error(
                `Failed to decompress gzipped data: ${decompressError instanceof Error ? decompressError.message : "Unknown error"}`
              );
            }
          }
        } else {
          // DecompressionStream not supported - try fallback
          if (VIRTUAL_SLIDES_JSON_URL_FALLBACK) {
            console.warn("[VirtualSlides] DecompressionStream not supported, using fallback...");
            const fallbackRes = await fetch(VIRTUAL_SLIDES_JSON_URL_FALLBACK, {
              cache: "force-cache",
            });
            if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`);
            json = await fallbackRes.json();
            console.log("[VirtualSlides] ✅ Loaded from fallback (no DecompressionStream)");
          } else {
            throw new Error(
              "Your browser does not support decompressing gzipped files. Please use a modern browser or try again later."
            );
          }
        }
      } else {
        // Non-gzipped
        json = await res.json();
      }

      // The production dataset is the optimized v7/v8 format.
      if (!json.bases || !json.data) {
        throw new Error("[VirtualSlides] Unexpected dataset format — expected optimized v7/v8");
      }

      // Reverse the bases mapping: stored as {url: id}, we need {id: url}
      urlBases = {
        preview: reverseMapping(json.bases.preview),
        case: reverseMapping(json.bases.case),
        other: reverseMapping(json.bases.other),
      };

      // Toronto LMP is excluded from the search engine (kept in the raw corpus): its
      // viewer links are Shibboleth-walled and don't open reliably.
      const processedSlides: VirtualSlide[] = json.data
        .map((e) => normalizeToVirtualSlide(e))
        .filter((s) => s.repository !== "University of Toronto LMP");
      console.log("[VirtualSlides] ✅ Loaded v7/v8 production format");

      // Build the case-group sibling index (related slides). `groups` is absent on
      // pre-v9 datasets — getRelatedSlides then returns [] for everything.
      slideById.clear();
      for (const s of processedSlides) slideById.set(s.id, s);
      groupMembers = json.groups || {};

      // Store in memory for session (HTTP cache handles persistence)
      cachedSlides = processedSlides;

      // Build the WHO acronym + reverse-index synchronously. Earlier I
      // deferred this with `requestIdleCallback` to save Lighthouse TBT, but
      // that left a window where I'm Feeling Lucky / typed search fell back
      // to fuzzy text ranking (e.g. "ARMS" → mesenchymal chondrosarcoma
      // instead of alveolar RMS) because the WHO acronym set wasn't built
      // yet. Fetch itself takes ~700 ms, so the ~200–400 ms index build
      // happens after the hydration window — TBT impact stays small.
      buildSearchIndex(processedSlides);

      return processedSlides;
    })
    .catch((error) => {
      // Clear the cached promise on error so next attempt will retry
      console.error("[VirtualSlides] ❌ Fatal error, clearing cache:", error);
      cachedSlidesPromise = null;
      throw error;
    });

  return cachedSlidesPromise;
}

export interface ClientSearchOptions {
  query?: string;
  repository?: string;
  category?: string;
  subcategory?: string;
  randomSeed?: number;
  page?: number;
  limit?: number;
}

export function useClientVirtualSlides(defaultLimit: number = 20) {
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

        // Search using query
        if (hasQuery) {
          const {
            slides: rankedSlides,
            expandedTerms,
            method,
            confidence,
          } = await rankSlidesWithExpansion(list, options.query);
          if (mounted) {
            setFilteredAndRanked(rankedSlides);
            setExpandedSearchTerms(expandedTerms);
            setSearchMethod(method);
            setSearchConfidence(confidence);
          }
        } else {
          // No search text: show random slides from filtered list
          // This applies whether there are filters or not
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

        if (Object.prototype.hasOwnProperty.call(opts, "randomSeed"))
          next.randomSeed = opts.randomSeed;

        if (next.limit == null) next.limit = prev.limit ?? defaultLimit;
        if (next.page == null) next.page = 1;
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
    // Full processed dataset — exposed so consumers (e.g. the hero teaser's
    // "Random Slide" picker) can sample directly instead of running their own
    // copy of the fetch, which used to triple-count the 750 KiB dataset in
    // Lighthouse.
    allSlides,
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
