/**
 * Cache Debug Utility
 *
 * Provides easy-to-use functions for inspecting cache contents from the browser console.
 *
 * Usage in browser console:
 *   window.cacheDebug.showAll()          // Show all cache keys and sizes
 *   window.cacheDebug.showKey('lottie')  // Show specific key contents
 *   window.cacheDebug.clearAll()         // Clear all cache
 */

import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";

export interface CacheDebugInfo {
  key: string;
  namespace: string;
  size: string;
  ageMinutes: number;
  version: string;
  preview: string;
}

/**
 * Get all cache entries with metadata
 */
export function getAllCacheEntries(): CacheDebugInfo[] {
  if (typeof window === "undefined") return [];

  const entries: CacheDebugInfo[] = [];
  const now = Date.now();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("pathology-bites-")) continue;

      const value = localStorage.getItem(key);
      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        const size = new Blob([value]).size;
        const sizeStr = size > 1024 * 1024
          ? `${(size / (1024 * 1024)).toFixed(2)} MB`
          : size > 1024
          ? `${(size / 1024).toFixed(2)} KB`
          : `${size} B`;

        const ageMinutes = parsed.timestamp
          ? Math.round((now - parsed.timestamp) / 60000)
          : 0;

        // Extract namespace from key (pathology-bites-{namespace}-{key})
        const parts = key.split("-");
        const namespace = parts.length >= 3 ? parts[2] : "unknown";
        const shortKey = parts.slice(3).join("-") || parts.slice(2).join("-");

        // Create preview of data
        let preview = "...";
        if (parsed.data) {
          if (Array.isArray(parsed.data)) {
            preview = `Array(${parsed.data.length})`;
          } else if (typeof parsed.data === "object") {
            const keys = Object.keys(parsed.data);
            preview = keys.length > 3
              ? `Object { ${keys.slice(0, 3).join(", ")}, ... }`
              : `Object { ${keys.join(", ")} }`;
          } else {
            preview = String(parsed.data).substring(0, 50);
          }
        }

        entries.push({
          key: shortKey,
          namespace,
          size: sizeStr,
          ageMinutes,
          version: parsed.version || "?",
          preview,
        });
      } catch {
        // Not a unified cache entry, skip
      }
    }
  } catch (error) {
    console.error("Failed to get cache entries:", error);
  }

  return entries.sort((a, b) => a.namespace.localeCompare(b.namespace));
}

/**
 * Display all cache entries in a nice table
 */
export function showAllCacheEntries(): void {
  const entries = getAllCacheEntries();

  if (entries.length === 0) {
    console.log("📦 No cache entries found");
    return;
  }

  console.log(`📦 Found ${entries.length} cache entries:\n`);
  console.table(entries);

  const totalSize = entries.reduce((sum, entry) => {
    const sizeNum = parseFloat(entry.size);
    const unit = entry.size.includes("MB") ? 1024 * 1024
      : entry.size.includes("KB") ? 1024
      : 1;
    return sum + (sizeNum * unit);
  }, 0);

  const totalSizeStr = totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
    : totalSize > 1024
    ? `${(totalSize / 1024).toFixed(2)} KB`
    : `${totalSize} B`;

  console.log(`\n📊 Total cache size: ${totalSizeStr}`);
}

/**
 * Show contents of a specific cache key
 */
export function showCacheKey(namespaceOrKey: string): void {
  if (typeof window === "undefined") return;

  try {
    // Try to find matching keys
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(namespaceOrKey)) {
        allKeys.push(key);
      }
    }

    if (allKeys.length === 0) {
      console.log(`❌ No cache keys found matching: ${namespaceOrKey}`);
      return;
    }

    allKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (!value) return;

      try {
        const parsed = JSON.parse(value);
        console.log(`\n🔑 ${key}`);
        console.log("━".repeat(80));
        console.log("Version:", parsed.version);
        console.log("Timestamp:", new Date(parsed.timestamp).toLocaleString());
        console.log("TTL:", parsed.ttl === Infinity ? "Infinity" : `${parsed.ttl / 60000} minutes`);
        console.log("\nData:");
        console.log(parsed.data);
      } catch (error) {
        console.log(`❌ Failed to parse key ${key}:`, error);
      }
    });
  } catch (error) {
    console.error("Failed to show cache key:", error);
  }
}

/**
 * Clear all unified cache entries
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;

  const count = getAllCacheEntries().length;
  if (count === 0) {
    console.log("📦 No cache entries to clear");
    return;
  }

  if (confirm(`Are you sure you want to clear ${count} cache entries?`)) {
    unifiedCache.clearAll();
    console.log(`✅ Cleared ${count} cache entries`);
  }
}

/**
 * Clear a specific namespace
 */
export function clearNamespace(namespace: string): void {
  if (typeof window === "undefined") return;

  const namespaceConfig = Object.values(CACHE_NAMESPACES).find(
    ns => ns.name === namespace
  );

  if (!namespaceConfig) {
    console.error(`❌ Unknown namespace: ${namespace}`);
    console.log("Available namespaces:", Object.values(CACHE_NAMESPACES).map(ns => ns.name));
    return;
  }

  unifiedCache.clearNamespace(namespace as any);
  console.log(`✅ Cleared ${namespace} namespace`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): void {
  const entries = getAllCacheEntries();

  // Group by namespace
  const byNamespace: Record<string, { count: number; totalSize: number }> = {};

  entries.forEach(entry => {
    if (!byNamespace[entry.namespace]) {
      byNamespace[entry.namespace] = { count: 0, totalSize: 0 };
    }
    byNamespace[entry.namespace].count++;

    const sizeNum = parseFloat(entry.size);
    const unit = entry.size.includes("MB") ? 1024 * 1024
      : entry.size.includes("KB") ? 1024
      : 1;
    byNamespace[entry.namespace].totalSize += (sizeNum * unit);
  });

  console.log("\n📊 Cache Statistics by Namespace:\n");

  Object.entries(byNamespace).forEach(([namespace, stats]) => {
    const sizeStr = stats.totalSize > 1024 * 1024
      ? `${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB`
      : stats.totalSize > 1024
      ? `${(stats.totalSize / 1024).toFixed(2)} KB`
      : `${stats.totalSize} B`;

    console.log(`${namespace.padEnd(20)} ${stats.count} entries    ${sizeStr}`);
  });
}

// Export a convenient global object for console access
export const cacheDebug = {
  showAll: showAllCacheEntries,
  showKey: showCacheKey,
  clearAll: clearAllCache,
  clearNamespace,
  stats: getCacheStats,
  entries: getAllCacheEntries,
};

// Make available globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).cacheDebug = cacheDebug;
  console.log("💡 Cache debug tools available! Try: cacheDebug.showAll()");
}
