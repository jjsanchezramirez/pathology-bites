/**
 * Client-side wrapper for NCI EVS term expansion
 *
 * Strategy:
 * 1. Check pre-computed expansions from R2/CDN (instant, $0 cost)
 * 2. Check in-memory cache (instant)
 * 3. Fall back to API proxy for rare terms (Vercel invocation)
 */

// URL to pre-computed expansion map (uploaded to virtual-slides directory)
const PRECOMPUTED_EXPANSIONS_URL = "/virtual-slides/nci-evs-expansions.json";

// Pre-computed expansions (loaded once from R2)
let precomputedExpansions: Record<string, { expansions: string[] }> | null = null;
let precomputedExpansionsPromise: Promise<void> | null = null;

// Static fallback abbreviations (if R2 fails to load)
const STATIC_ABBREVIATIONS: Record<string, string[]> = {
  dlbcl: ["diffuse large b cell lymphoma"],
  cll: ["chronic lymphocytic leukemia"],
  aml: ["acute myeloid leukemia"],
  all: ["acute lymphoblastic leukemia"],
  cml: ["chronic myeloid leukemia"],
  fl: ["follicular lymphoma"],
  hl: ["hodgkin lymphoma", "hodgkin's lymphoma"],
  nhl: ["non hodgkin lymphoma", "non-hodgkin lymphoma"],
  mm: ["multiple myeloma"],
  dcis: ["ductal carcinoma in situ"],
  lcis: ["lobular carcinoma in situ"],
  idc: ["invasive ductal carcinoma"],
  ilc: ["invasive lobular carcinoma"],
  hcc: ["hepatocellular carcinoma"],
  crc: ["colorectal carcinoma"],
  gist: ["gastrointestinal stromal tumor"],
  scc: ["squamous cell carcinoma"],
  bcc: ["basal cell carcinoma"],
  rcc: ["renal cell carcinoma"],
  tcc: ["transitional cell carcinoma"],
  aitl: ["angioimmunoblastic t cell lymphoma"],
  ptc: ["papillary thyroid carcinoma"],
};

interface CachedExpansion {
  terms: string[];
  timestamp: number;
  source: "nci_evs" | "static" | "hybrid";
}

// Cache for NCI EVS expansions (7 day TTL)
const expansionCache = new Map<string, CachedExpansion>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Normalize text for caching and comparison
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Load pre-computed expansions from R2 (called once on first search)
 */
async function loadPrecomputedExpansions(): Promise<void> {
  if (precomputedExpansions) return; // Already loaded
  if (precomputedExpansionsPromise) return precomputedExpansionsPromise; // Already loading

  precomputedExpansionsPromise = (async () => {
    try {
      console.log("[NCI EVS] Loading pre-computed expansions from R2...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(PRECOMPUTED_EXPANSIONS_URL, {
        signal: controller.signal,
        cache: "force-cache", // Aggressive caching
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }

      precomputedExpansions = await response.json();
      console.log(
        `[NCI EVS] ✓ Loaded ${Object.keys(precomputedExpansions!).length} pre-computed expansions`
      );
    } catch (error) {
      console.warn(
        "[NCI EVS] Failed to load pre-computed expansions, will use API fallback:",
        error
      );
      precomputedExpansions = {}; // Empty object to avoid retrying
    }
  })();

  return precomputedExpansionsPromise;
}

/**
 * Call our API proxy to get NCI EVS expansions (avoids CORS issues)
 */
async function searchNCIEVSClient(term: string): Promise<string[]> {
  try {
    console.log(`[NCI EVS Client] Searching for: "${term}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(
      `/api/public/tools/virtual-slides/nci?term=${encodeURIComponent(term)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[NCI EVS Client] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.expansions) {
      console.log(`[NCI EVS Client] No results for "${term}"`);
      return [];
    }

    // The API returns all expansions including the original term
    // We want to exclude the original term from the result
    const expansions = data.expansions.filter((exp: string) => exp !== normalize(term));

    console.log(`[NCI EVS Client] Found ${expansions.length} expansions from ${data.source}`);
    return expansions;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn("[NCI EVS Client] Request timeout");
      } else {
        console.error("[NCI EVS Client] Search failed:", error.message);
      }
    }
    return [];
  }
}

/**
 * Get expanded terms for a search query (client-side version)
 *
 * Priority:
 * 1. In-memory cache (instant)
 * 2. Pre-computed expansions from R2 (instant, $0 cost)
 * 3. API proxy for rare terms (Vercel invocation)
 */
export async function expandSearchTermClient(term: string): Promise<string[]> {
  const normalized = normalize(term);
  const results = [normalized]; // Always include the original term

  // Check in-memory cache first
  const cached = expansionCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Expansion Client] Using cached ${cached.source} results for "${term}"`);
    return [...results, ...cached.terms];
  }

  // Load pre-computed expansions from R2 (only once)
  await loadPrecomputedExpansions();

  // Check pre-computed expansions (99% of searches hit here - $0 cost!)
  if (precomputedExpansions && precomputedExpansions[normalized]) {
    const expansions = precomputedExpansions[normalized].expansions;
    console.log(
      `[Expansion Client] Using pre-computed expansions for "${term}" (${expansions.length} terms)`
    );

    // Cache it
    expansionCache.set(normalized, {
      terms: expansions,
      timestamp: Date.now(),
      source: "nci_evs",
    });

    results.push(...expansions);
    return results;
  }

  // Fallback to API proxy for rare/new terms (Vercel invocation)
  console.log(`[Expansion Client] Term "${term}" not in pre-computed map, calling API...`);
  const expansions = await searchNCIEVSClient(term);

  // Cache the result
  if (expansions.length > 0) {
    expansionCache.set(normalized, {
      terms: expansions,
      timestamp: Date.now(),
      source: "nci_evs",
    });

    console.log(`[Expansion Client] Cached ${expansions.length} terms for "${term}"`);
  }

  results.push(...expansions);
  return results;
}

/**
 * Synchronous fallback using only static abbreviations
 * Use this when you can't wait for the async API call
 */
export function expandSearchTermSync(term: string): string[] {
  const normalized = normalize(term);
  const staticTerms = STATIC_ABBREVIATIONS[normalized] || [];

  return [normalized, ...staticTerms.map((t) => normalize(t))];
}
