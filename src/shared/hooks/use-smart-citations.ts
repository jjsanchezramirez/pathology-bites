// src/shared/hooks/use-smart-citations.ts
/**
 * Smart caching hook for citation generation
 * Minimizes API calls with intelligent client-side caching
 */

import { useState, useCallback } from "react";
import { CitationData } from "@/shared/utils/citation-extractor";
import { toast } from "@/shared/utils/toast";
import {
  getCachedItem,
  setCachedItem,
  clearToolCache,
  getCacheStats as getPublicToolsCacheStats,
  getRecentItems,
} from "@/shared/utils/public-tools-cache";

interface UseSmartCitationsResult {
  generateCitation: (input: string, type: "url" | "doi" | "isbn") => Promise<CitationData>;
  isLoading: boolean;
  error: string | null;
  clearCache: () => void;
  getCacheStats: () => { size: number };
  getRecentCitations: (
    limit?: number
  ) => Array<{ key: string; data: CitationData; timestamp: number }>;
}

export function useSmartCitations(): UseSmartCitationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize input for consistent caching
  const normalizeInput = useCallback((input: string, type: "url" | "doi" | "isbn"): string => {
    const trimmed = input.trim().toLowerCase();

    switch (type) {
      case "doi":
        return trimmed.replace(/^doi:/, "").replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
      case "isbn":
        return trimmed.replace(/[-\s]/g, "").replace(/^isbn:?/i, "");
      case "url":
        return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      default:
        return trimmed;
    }
  }, []);

  const generateCitation = useCallback(
    async (input: string, type: "url" | "doi" | "isbn"): Promise<CitationData> => {
      if (!input.trim()) {
        throw new Error("Input cannot be empty");
      }

      setIsLoading(true);
      setError(null);

      try {
        const normalizedInput = normalizeInput(input, type);
        const cacheKey = `${type}:${normalizedInput}`;

        // Check cache first
        const cached = getCachedItem<CitationData>("citations", cacheKey);
        if (cached) {
          setIsLoading(false);
          return cached;
        }

        let citationData: CitationData;

        switch (type) {
          case "url":
            const urlResponse = await fetch(
              `/api/public/tools/citation-generator/extract-url-metadata?url=${encodeURIComponent(input.trim())}`
            );
            if (!urlResponse.ok) {
              const errorData = await urlResponse.json().catch(() => ({ error: "Unknown error" }));
              throw new Error(
                errorData.error || `HTTP ${urlResponse.status}: Failed to fetch website metadata`
              );
            }
            const urlMetadata = await urlResponse.json();
            citationData = {
              title: urlMetadata.title || extractTitleFromUrl(input),
              authors:
                Array.isArray(urlMetadata.authors) && urlMetadata.authors.length > 0
                  ? urlMetadata.authors
                  : ["Unknown Author"],
              year: urlMetadata.year || new Date().getFullYear().toString(),
              url: input,
              publisher: urlMetadata.publisher || extractDomainFromUrl(input),
              accessDate: new Date().toLocaleDateString("en-CA"),
              type: "website",
            };
            break;

          case "isbn":
            const cleanIsbn = input.replace(/[-\s]/g, "");
            const isbnResponse = await fetch(
              `/api/public/tools/citation-generator/extract-book-metadata?isbn=${encodeURIComponent(cleanIsbn)}`
            );
            if (!isbnResponse.ok) {
              const errorData = await isbnResponse.json().catch(() => ({ error: "Unknown error" }));
              throw new Error(
                errorData.error || `HTTP ${isbnResponse.status}: Failed to fetch book metadata`
              );
            }
            const bookMetadata = await isbnResponse.json();
            citationData = {
              title: bookMetadata.title || "Unknown Title",
              authors:
                Array.isArray(bookMetadata.authors) && bookMetadata.authors.length > 0
                  ? bookMetadata.authors
                  : ["Unknown Author"],
              year: bookMetadata.year || new Date().getFullYear().toString(),
              publisher: bookMetadata.publisher || "Unknown Publisher",
              type: "book",
            };
            break;

          case "doi":
            const cleanDoi = input
              .replace(/^doi:/, "")
              .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
            const doiResponse = await fetch(
              `/api/public/tools/citation-generator/extract-journal-metadata?doi=${encodeURIComponent(cleanDoi)}`
            );
            if (!doiResponse.ok) {
              const errorData = await doiResponse.json().catch(() => ({ error: "Unknown error" }));
              throw new Error(
                errorData.error || `HTTP ${doiResponse.status}: Failed to fetch journal metadata`
              );
            }
            const journalMetadata = await doiResponse.json();
            citationData = {
              title: journalMetadata.title || "Unknown Title",
              authors:
                Array.isArray(journalMetadata.authors) && journalMetadata.authors.length > 0
                  ? journalMetadata.authors
                  : ["Unknown Author"],
              year: journalMetadata.year || new Date().getFullYear().toString(),
              journal: journalMetadata.journal || "Unknown Journal",
              volume: journalMetadata.volume,
              issue: journalMetadata.issue,
              pages: journalMetadata.pages,
              doi: journalMetadata.doi || cleanDoi,
              url: journalMetadata.url,
              type: "journal",
            };
            break;

          default:
            throw new Error("Unsupported citation type");
        }

        // Save to cache
        setCachedItem("citations", cacheKey, citationData);

        return citationData;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate citation";
        setError(errorMessage);

        // Show toast notification for errors
        const isNetworkError =
          err instanceof TypeError &&
          (err.message?.includes("fetch") || err.message?.includes("network"));

        if (isNetworkError) {
          toast.error("Network connection interrupted. Please refresh the page.");
        } else {
          toast.error(errorMessage);
        }

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [normalizeInput]
  );

  const clearCache = useCallback(() => {
    clearToolCache("citations");
  }, []);

  const getCacheStats = useCallback(() => {
    return getPublicToolsCacheStats("citations");
  }, []);

  const getRecentCitations = useCallback((limit: number = 10) => {
    return getRecentItems<CitationData>("citations", limit);
  }, []);

  return {
    generateCitation,
    isLoading,
    error,
    clearCache,
    getCacheStats,
    getRecentCitations,
  };
}

// Helper functions
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown Website";
  }
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment !== "index.html") {
      return lastSegment
        .replace(/[-_]/g, " ")
        .replace(/\.(html?|php|aspx?)$/i, "")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }

    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Web Page";
  }
}
