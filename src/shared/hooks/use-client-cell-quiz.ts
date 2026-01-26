"use client";

import { useEffect, useState } from "react";
import { CELL_QUIZ_IMAGES_URL, CELL_QUIZ_REFERENCES_URL } from "@/shared/config/cell-quiz";
import { transformCellQuizData } from "@/shared/utils/r2-url-transformer";
import { toast } from "@/shared/utils/toast";

// Type definitions for cell quiz data
export interface CellImageData {
  name: string;
  description: string;
  key_features: string[];
  images: string[];
  look_alikes?: string[];
}

export interface BloodCellReference {
  name: string;
  key_features: string;
  description: string;
  size?: string;
  nc_ratio?: string;
  nucleus?: string;
  lineage?: string;
  normal_percentage?: string;
  clinical_significance?: string;
  notes?: string;
}

export interface BloodCellsReferenceData {
  cells: BloodCellReference[];
}

export interface CellQuizImagesData {
  [cellKey: string]: CellImageData;
}

// Module-scope cache so we only fetch once per session
let cachedImagesPromise: Promise<CellQuizImagesData> | null = null;
let cachedReferencesPromise: Promise<BloodCellsReferenceData> | null = null;

interface UseCellQuizResult {
  cellData: CellQuizImagesData | null;
  bloodCellsReference: BloodCellsReferenceData | null;
  isLoading: boolean;
  error: string | null;
}

async function loadCellQuizImages(): Promise<CellQuizImagesData> {
  if (cachedImagesPromise) return cachedImagesPromise;

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
      const res = await fetchWithTimeout(CELL_QUIZ_IMAGES_URL, {
        cache: "force-cache",
        headers: {
          Accept: "application/json",
        },
        timeoutMs: 8000,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res;
    } catch (e) {
      console.warn(
        "[CellQuiz Images] R2 fetch failed in dev, falling back to /api/public/data/cell-quiz-images",
        e
      );

      // Fallback to server-side API (same as virtual slides)
      try {
        const fallbackRes = await fetchWithTimeout("/api/public/data/cell-quiz-images", {
          cache: "force-cache",
          headers: {
            Accept: "application/json",
          },
          timeoutMs: 8000,
        });
        if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`);
        return fallbackRes;
      } catch (fallbackError) {
        const msg =
          e?.name === "AbortError"
            ? "Timed out fetching cell quiz images. Please check your network and try again."
            : e?.message || "Failed to fetch cell quiz images.";

        console.error("[CellQuiz Images] Both R2 and fallback API failed.", fallbackError);
        throw new Error(msg);
      }
    }
  }

  cachedImagesPromise = fetchWithFallback().then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch cell quiz images: ${res.status}`);
    const data = await res.json();
    // Transform URLs to use R2 public URLs on client-side
    return transformCellQuizData(data) as CellQuizImagesData;
  });

  return cachedImagesPromise;
}

async function loadCellQuizReferences(): Promise<BloodCellsReferenceData> {
  if (cachedReferencesPromise) return cachedReferencesPromise;

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
      const res = await fetchWithTimeout(CELL_QUIZ_REFERENCES_URL, {
        cache: "force-cache",
        headers: {
          Accept: "application/json",
        },
        timeoutMs: 8000,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res;
    } catch (e) {
      console.warn(
        "[CellQuiz References] R2 fetch failed in dev, falling back to /api/public/data/cell-quiz-references",
        e
      );

      // Fallback to server-side API (same as virtual slides)
      try {
        const fallbackRes = await fetchWithTimeout("/api/public/data/cell-quiz-references", {
          cache: "force-cache",
          headers: {
            Accept: "application/json",
          },
          timeoutMs: 8000,
        });
        if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`);
        return fallbackRes;
      } catch (fallbackError) {
        const msg =
          e?.name === "AbortError"
            ? "Timed out fetching cell quiz references. Please check your network and try again."
            : e?.message || "Failed to fetch cell quiz references.";

        console.error("[CellQuiz References] Both R2 and fallback API failed.", fallbackError);
        throw new Error(msg);
      }
    }
  }

  cachedReferencesPromise = fetchWithFallback().then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch cell quiz references: ${res.status}`);
    return await res.json();
  });

  return cachedReferencesPromise;
}

export function useClientCellQuiz(): UseCellQuizResult {
  const [cellData, setCellData] = useState<CellQuizImagesData | null>(null);
  const [bloodCellsReference, setBloodCellsReference] = useState<BloodCellsReferenceData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        console.log("🔄 Loading cell quiz data from R2...");

        // Load both datasets in parallel
        const [imagesData, referencesData] = await Promise.all([
          loadCellQuizImages(),
          loadCellQuizReferences(),
        ]);

        if (mounted) {
          setCellData(imagesData);
          setBloodCellsReference(referencesData);

          console.log("✅ Cell quiz data loaded successfully:", {
            images: {
              cellCount: imagesData ? Object.keys(imagesData).length : 0,
              sampleCells: imagesData ? Object.keys(imagesData).slice(0, 3) : [],
              dataSize: imagesData
                ? `${(JSON.stringify(imagesData).length / 1024).toFixed(1)}KB`
                : "0KB",
            },
            references: {
              hasCells: !!referencesData?.cells,
              cellCount: referencesData?.cells?.length || 0,
              dataSize: referencesData
                ? `${(JSON.stringify(referencesData).length / 1024).toFixed(1)}KB`
                : "0KB",
            },
          });
        }
      } catch (err) {
        console.error("❌ Failed to load cell quiz data:", err);
        if (mounted) {
          const errorMessage = err.message || "Failed to load cell quiz data";
          setError(errorMessage);

          // Detect network errors (laptop sleep/wake, offline, etc.)
          const isNetworkError =
            err instanceof TypeError &&
            (err.message?.includes("fetch") || err.message?.includes("network"));

          if (isNetworkError) {
            toast.error("Network connection interrupted. Please refresh the page.");
          } else if (err.message?.includes("Timed out") || err.name === "AbortError") {
            toast.error("Request timed out. Please check your network connection.");
          } else {
            toast.error(errorMessage);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    cellData,
    bloodCellsReference,
    isLoading,
    error,
  };
}
