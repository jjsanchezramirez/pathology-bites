import { useState, useCallback, useRef } from "react";
import { useClientWSIData } from "./use-client-wsi-data";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getWSIHistoryTracker } from "@/features/user/wsi-questions/utils/wsi-history-tracker";
import { slideMatchesCategory } from "@/features/user/wsi-questions/components/wsi-question-generator-utils";
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
  /**
   * The slide chosen for the question currently being generated, published as
   * soon as it is picked — before the model is called.
   *
   * The slide is known ~instantly but its tiles take seconds to load, and the
   * question text takes seconds to generate. Exposing the slide early lets the
   * viewer start fetching tiles during generation instead of after it, so the
   * two waits overlap and the reader can begin looking at histology while the
   * question is still being written.
   */
  pendingSlide: VirtualSlide | null;
  /**
   * Warm a question for `category` without consuming it. Call when the user
   * changes category: the pending prefetch is keyed by category, so switching
   * otherwise throws it away and the next question pays full latency.
   */
  startPrefetch: (category?: string) => void;
}

/**
 * WSI Question Generator Hook
 * Calls the single generate endpoint; the model fallback chain is walked
 * server-side, so there is no client-side model loop any more.
 */
export function useWSIQuestionGenerator(): UseWSIQuestionGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlide, setPendingSlide] = useState<VirtualSlide | null>(null);
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

  /**
   * Select a slide and generate one question. No UI state: this runs both for
   * the request the user is waiting on and for the background prefetch.
   */
  const produceQuestion = useCallback(
    async (
      category?: string,
      onSlideSelected?: (wsi: VirtualSlide) => void
    ): Promise<GeneratedQuestion> => {
      const startTime = Date.now();

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
            slideMatchesCategory(slide.category, category)
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

        // Publish the slide before the model call so the viewer can start
        // fetching tiles during generation rather than after it. Background
        // prefetches pass no callback — they must stay invisible.
        onSlideSelected?.(selectedWSI);

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
        log.error("[WSI Generator] Generation failed:", err instanceof Error ? err.message : err);
        throw err;
      }
    },
    [requestQuestion, wsiData, wsiError]
  );

  /**
   * A question generated ahead of time for the category the user is on.
   *
   * Questions are consumed one after another, so the wait for every question
   * after the first can be spent while the reader is still on the previous one.
   * Generation measured ~1-4s, so this is the difference between a visible
   * spinner and none. Held in a ref because nothing renders from it.
   */
  const prefetchRef = useRef<{ category: string; promise: Promise<GeneratedQuestion> } | null>(
    null
  );

  const startPrefetch = useCallback(
    (category?: string) => {
      const key = category || "all";
      if (prefetchRef.current?.category === key) return;
      const promise = produceQuestion(category);
      // A failed prefetch must stay invisible — the user never asked for it.
      // Drop it so the next real request generates fresh instead of replaying
      // the failure.
      promise.catch(() => {
        if (prefetchRef.current?.promise === promise) prefetchRef.current = null;
      });
      prefetchRef.current = { category: key, promise };
    },
    [produceQuestion]
  );

  const generateQuestion = useCallback(
    async (category?: string): Promise<GeneratedQuestion> => {
      const key = category || "all";
      const ready = prefetchRef.current?.category === key ? prefetchRef.current : null;
      // A prefetch for a different category is now useless — drop it so the
      // next prefetch targets what the user is actually looking at.
      if (!ready) prefetchRef.current = null;

      setIsGenerating(true);
      setError(null);
      try {
        let question: GeneratedQuestion;
        if (ready) {
          prefetchRef.current = null;
          try {
            question = await ready.promise;
            log.debug("[WSI Generator] Served from prefetch");
          } catch {
            question = await produceQuestion(category, setPendingSlide);
          }
        } else {
          question = await produceQuestion(category, setPendingSlide);
        }
        // Line up the next one while the reader works through this one.
        startPrefetch(category);
        return question;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        throw err;
      } finally {
        setIsGenerating(false);
        // The real question carries its own slide from here on.
        setPendingSlide(null);
      }
    },
    [produceQuestion, startPrefetch]
  );

  return {
    generateQuestion,
    isGenerating,
    error,
    clearError,
    isWSIDataLoading: isLoadingWSI,
    isReady: !isLoadingWSI && !wsiError && wsiData !== null,
    wsiData,
    pendingSlide,
    startPrefetch,
  };
}
