/**
 * Public Tools Cache Manager
 *
 * Manages a unified cache structure for all public tools:
 * {
 *   citations: { "doi:10.1234": {...}, "url:https://...": {...} },
 *   milan: { "TP53": {...}, "BRCA1": {...} }
 * }
 */

const CACHE_KEY = "pathology-bites-public-tools";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ITEMS_PER_TOOL = 100; // Limit per tool

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface PublicToolsCache {
  citations?: Record<string, CacheEntry<unknown>>;
  milan?: Record<string, CacheEntry<unknown>>;
}

/**
 * Get the entire public tools cache
 */
function getCache(): PublicToolsCache {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save the entire public tools cache
 */
function saveCache(cache: PublicToolsCache): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail - cache is optional
  }
}

/**
 * Clean expired entries for a specific tool
 */
function cleanExpiredEntries(
  entries: Record<string, CacheEntry<unknown>>
): Record<string, CacheEntry<unknown>> {
  const now = Date.now();
  const cleaned: Record<string, CacheEntry<unknown>> = {};

  Object.entries(entries).forEach(([key, entry]) => {
    if (now - entry.timestamp < CACHE_TTL) {
      cleaned[key] = entry;
    }
  });

  return cleaned;
}

/**
 * Limit cache size by removing oldest entries
 */
function limitCacheSize(
  entries: Record<string, CacheEntry<unknown>>,
  maxSize: number
): Record<string, CacheEntry<unknown>> {
  const sorted = Object.entries(entries).sort(
    ([, a], [, b]) => b.timestamp - a.timestamp // Newest first
  );

  return Object.fromEntries(sorted.slice(0, maxSize));
}

/**
 * Get a cached item from a specific tool
 */
export function getCachedItem<T>(tool: keyof PublicToolsCache, key: string): T | null {
  const cache = getCache();
  const toolCache = cache[tool];

  if (!toolCache || !toolCache[key]) {
    return null;
  }

  const entry = toolCache[key] as CacheEntry<T>;
  const now = Date.now();

  // Check if expired
  if (now - entry.timestamp > CACHE_TTL) {
    return null;
  }

  return entry.data;
}

/**
 * Set a cached item for a specific tool
 */
export function setCachedItem<T>(tool: keyof PublicToolsCache, key: string, data: T): void {
  const cache = getCache();

  // Initialize tool cache if needed
  if (!cache[tool]) {
    cache[tool] = {};
  }

  // Clean expired entries
  cache[tool] = cleanExpiredEntries(cache[tool]!);

  // Add new entry
  cache[tool]![key] = {
    data,
    timestamp: Date.now(),
  };

  // Limit size
  cache[tool] = limitCacheSize(cache[tool]!, MAX_ITEMS_PER_TOOL);

  saveCache(cache);
}

/**
 * Get recent items from a specific tool (sorted by timestamp, newest first)
 */
export function getRecentItems<T>(
  tool: keyof PublicToolsCache,
  limit: number = 10
): Array<{ key: string; data: T; timestamp: number }> {
  const cache = getCache();
  const toolCache = cache[tool];

  if (!toolCache) {
    return [];
  }

  // Clean expired entries
  const cleaned = cleanExpiredEntries(toolCache);

  // Sort by timestamp (newest first) and limit
  const sorted = Object.entries(cleaned)
    .map(([key, entry]) => ({
      key,
      data: (entry as CacheEntry<T>).data,
      timestamp: entry.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return sorted;
}

/**
 * Clear cache for a specific tool
 */
export function clearToolCache(tool: keyof PublicToolsCache): void {
  const cache = getCache();
  delete cache[tool];
  saveCache(cache);
}

/**
 * Clear all public tools cache
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get cache statistics
 */
export function getCacheStats(tool?: keyof PublicToolsCache): {
  size: number;
  totalSize?: number;
  citationsSize?: number;
  milanSize?: number;
} {
  const cache = getCache();

  if (tool) {
    return {
      size: Object.keys(cache[tool] || {}).length,
    };
  }

  return {
    totalSize: Object.keys(cache.citations || {}).length + Object.keys(cache.milan || {}).length,
    citationsSize: Object.keys(cache.citations || {}).length,
    milanSize: Object.keys(cache.milan || {}).length,
    size: Object.keys(cache.citations || {}).length + Object.keys(cache.milan || {}).length,
  };
}
