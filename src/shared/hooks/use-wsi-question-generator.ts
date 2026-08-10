import { useState, useCallback } from "react";
import { useClientWSIData } from "./use-client-wsi-data";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getWSIHistoryTracker } from "@/features/user/wsi-questions/utils/wsi-history-tracker";
import { log } from "@/shared/utils/logging";

interface QuestionData {
  stem: string;
  options: Array<{
    id: string;
    text: string;
    is_correct: boolean;
    explanation: string;
  }>;
  teaching_point: string;
  references: string[];
}

interface APIQuestionData {
  stem: string;
  options: Array<{
    id: string;
    text: string;
    is_correct: boolean;
    explanation: string;
  }>;
  teaching_point: string;
  references: string[];
}

export interface GeneratedQuestion {
  id: string;
  wsi: VirtualSlide;
  question: QuestionData;
  context: unknown;
  metadata: {
    generated_at: string;
    model: string;
    generation_time_ms: number;
    modelIndex?: number;
    image_verification?: unknown;
    fallback_attempts?: number;
    successful_model?: string;
    token_usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | null;
  };
  debug?: {
    prompt: string;
    instructions: string;
  } | null;
}

// Type for the API response from generateQuestionWithFallback
interface QuestionGenerationResponse {
  success: boolean;
  question: APIQuestionData;
  metadata?: {
    model?: string;
    token_usage?: unknown;
  };
  debug?: unknown;
}

interface UseWSIQuestionGeneratorReturn {
  generateQuestion: (category?: string) => Promise<GeneratedQuestion>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
  isWSIDataLoading: boolean;
  isReady: boolean;
  wsiData: VirtualSlide[] | null;
}

/**
 * WSI Question Generator Hook
 * Calls the single generate endpoint; the model fallback chain is walked
 * server-side, so there is no client-side model loop any more.
 */
export function useWSIQuestionGenerator(): UseWSIQuestionGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { wsiData, isLoading: isLoadingWSI, error: wsiError } = useClientWSIData();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * One request, one answer. The server walks every model itself, so a failure
   * here is final — there is nothing for the client to retry, which is what
   * removed the old recursive walk (an unexpected error shape once made it
   * re-request forever against an expired session).
   */
  const requestQuestion = useCallback(async (wsi: unknown): Promise<QuestionGenerationResponse> => {
    const response = await fetch("/api/user/wsi-questions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wsi }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Your session has expired. Please sign in again to generate questions.");
      }
      let details = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        details = body.details || body.error || details;
      } catch {
        // Non-JSON error body — keep the status line.
      }
      throw new Error(`Question generation failed: ${details}`);
    }

    const data = await response.json();
    if (!data.success || !data.question) {
      throw new Error(data.error || "Question generation returned no question");
    }
    return data;
  }, []);

  const generateQuestion = useCallback(
    async (category?: string): Promise<GeneratedQuestion> => {
      const startTime = Date.now();
      setIsGenerating(true);
      setError(null);

      try {
        log.debug("[WSI Generator] Starting question generation");

        // Ensure WSI data is available - use direct access to cached promise
        let finalWSIData = wsiData;

        if (!finalWSIData || finalWSIData.length === 0) {
          if (wsiError) {
            throw new Error(`WSI data error: ${wsiError}`);
          }

          log.debug("[WSI Generator] WSI data not available in hook, accessing cache directly...");

          try {
            // Import and call the loadClientWSIData function directly
            const { loadClientWSIData } = await import("./use-client-wsi-data");
            finalWSIData = await loadClientWSIData();
            log.debug(
              "[WSI Generator] ✅ WSI data loaded from cache:",
              finalWSIData.length,
              "slides"
            );
          } catch (cacheError) {
            throw new Error("Failed to load WSI data from cache: " + (cacheError as Error).message);
          }
        }

        // Check if we have any WSI data at all
        if (!finalWSIData || finalWSIData.length === 0) {
          throw new Error(
            "No WSI slides available. This may be due to repository filtering or data loading issues."
          );
        }

        // Step 1: Select WSI using simplified approach with history tracking
        log.debug(
          `[WSI Generator] Step 1 - Selecting WSI from ${finalWSIData.length} available slides...`
        );
        let selectedWSI: VirtualSlide;

        // Get history tracker
        const historyTracker = getWSIHistoryTracker();
        const effectiveCategory = category || "all";
        const recentIds = historyTracker.getRecentIds(effectiveCategory);

        log.debug(
          `[WSI Generator] Recent history size for "${effectiveCategory}": ${recentIds.length} slides`
        );

        if (category && category !== "all") {
          // Filter by category first
          const categorySlides = finalWSIData.filter((slide) =>
            slide.category.toLowerCase().includes(category.toLowerCase())
          );

          if (categorySlides.length === 0) {
            throw new Error(
              `No WSI slides found for category: ${category}. Available slides: ${finalWSIData.length}`
            );
          }

          // Filter out recently shown slides
          let availableSlides = categorySlides.filter((slide) => !recentIds.includes(slide.id));

          // If all slides in category have been shown, reset and use all category slides
          if (availableSlides.length === 0) {
            log.debug(
              `[WSI Generator] All ${categorySlides.length} slides in "${category}" have been shown. Resetting history for this category.`
            );
            historyTracker.clearCategory(effectiveCategory);
            availableSlides = categorySlides;
          }

          selectedWSI = availableSlides[Math.floor(Math.random() * availableSlides.length)];
          log.debug(
            `[WSI Generator] Selected from ${availableSlides.length} available slides in category: ${category} (${categorySlides.length} total, ${recentIds.length} recently shown)`
          );
        } else {
          // Filter out recently shown slides from all slides
          let availableSlides = finalWSIData.filter((slide) => !recentIds.includes(slide.id));

          // If all slides have been shown, reset and use all slides
          if (availableSlides.length === 0) {
            log.debug(
              `[WSI Generator] All ${finalWSIData.length} slides have been shown. Resetting history.`
            );
            historyTracker.clearAll();
            availableSlides = finalWSIData;
          }

          const randomIndex = Math.floor(Math.random() * availableSlides.length);
          selectedWSI = availableSlides[randomIndex];

          if (!selectedWSI) {
            throw new Error("Failed to select random WSI");
          }
          log.debug(
            `[WSI Generator] Selected random slide from ${availableSlides.length} available slides (${finalWSIData.length} total, ${recentIds.length} recently shown)`
          );
        }

        log.debug(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`);

        // Step 2: Generate question using main generate route
        log.debug("[WSI Generator] Step 2 - Using main generate route...");

        const questionData = await requestQuestion(selectedWSI);

        if (!questionData.success || !questionData.question) {
          throw new Error("Failed to generate question");
        }

        // Log token usage for debugging
        log.debug("[WSI Generator] Token usage from API:", questionData.metadata?.token_usage);

        // Combine all data into the expected format
        const generationTime = Date.now() - startTime;

        // Map API response format to hook interface format
        const apiQuestion = questionData.question as APIQuestionData;
        const questionWithOptions: QuestionData = {
          ...apiQuestion,
          options: apiQuestion.options || [],
        };

        const generatedQuestion: GeneratedQuestion = {
          id: `wsi-${selectedWSI.id}-${Date.now()}`,
          wsi: selectedWSI,
          question: questionWithOptions,
          context: null,
          metadata: {
            generated_at: new Date().toISOString(),
            model: questionData.metadata?.model || "unknown",
            generation_time_ms: generationTime,
            image_verification: undefined,
            token_usage: questionData.metadata?.token_usage as
              | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
              | null
              | undefined,
          },
          debug: questionData.debug as { prompt: string; instructions: string } | null | undefined,
        };

        // Add to history after successful generation
        historyTracker.addToHistory(selectedWSI.id, effectiveCategory);
        log.debug(
          `[WSI Generator] Added ${selectedWSI.id} to history. Stats:`,
          historyTracker.getStats()
        );

        return generatedQuestion;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        log.error("[WSI Generator] Client-side generation failed:", errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [requestQuestion, wsiData, wsiError]
  );

  return {
    generateQuestion,
    isGenerating,
    error,
    clearError,
    isWSIDataLoading: isLoadingWSI,
    isReady: !isLoadingWSI && !wsiError && wsiData !== null,
    wsiData,
  };
}
