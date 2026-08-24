import { useState, useCallback, useRef } from "react";
import { useClientWSIData } from "./use-client-wsi-data";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getWSIHistoryTracker } from "@/features/user/wsi-questions/utils/wsi-history-tracker";
import { slideMatchesCategory } from "@/features/user/wsi-questions/components/wsi-question-generator-utils";
import { candidateAlterations } from "@/features/user/wsi-questions/utils/wsi-question-options";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import {
  WSI_QUESTION_KINDS,
  buildWsiQuestionPrompt,
  chooseKind,
  DEFAULT_WSI_KINDS,
  slideSupportsKind,
  type WsiQuestionKind,
} from "@/features/user/wsi-questions/utils/wsi-question-kinds";

/** Human-readable names for the error the kind filter can produce. */
const KIND_LABELS: Record<WsiQuestionKind, string> = Object.fromEntries(
  WSI_QUESTION_KINDS.map((k) => [k.id, k.label])
) as Record<WsiQuestionKind, string>;

/**
 * Cache key for a prefetch. Sorted, so enabling {diagnosis, ihc} and
 * {ihc, diagnosis} share one entry instead of each starting its own request.
 */
function prefetchKey(category: string | undefined, kinds: WsiQuestionKind[]): string {
  return `${category || "all"}|${[...kinds].sort().join(",")}`;
}
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
    /** Row id in wsi_question_events, so the answer can be reported against
     *  this exact generation. Null when the event could not be written. */
    event_id?: string | null;
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
    event_id?: string | null;
  };
  debug?: unknown;
}

interface UseWSIQuestionGeneratorReturn {
  generateQuestion: (category?: string, kinds?: WsiQuestionKind[]) => Promise<GeneratedQuestion>;
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
  startPrefetch: (category?: string, kinds?: WsiQuestionKind[]) => void;
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
  const requestQuestion = useCallback(
    async (
      wsi: VirtualSlide,
      kind: WsiQuestionKind,
      candidates: string[] = []
    ): Promise<QuestionGenerationResponse> => {
      // The prompt is built client-side per question kind. IHC and molecular
      // questions must be handed their correct answer (the case's own recorded
      // profile) rather than asked to invent one — a model asked to produce both
      // the question and its own ground truth writes something plausible and
      // wrong, and nothing downstream can catch it.
      const response = await fetch("/api/user/wsi-questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wsi,
          // `kind` is sent alongside the prompt it produced. The server cannot
          // recover it from customPrompt, and which kinds learners actually
          // reach for is one of the things the event log is there to answer.
          kind,
          customPrompt: buildWsiQuestionPrompt(wsi, kind, candidates),
        }),
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
    },
    []
  );

  /**
   * Select a slide and generate one question. No UI state: this runs both for
   * the request the user is waiting on and for the background prefetch.
   */
  const produceQuestion = useCallback(
    async (
      category?: string,
      onSlideSelected?: (wsi: VirtualSlide) => void,
      kinds: WsiQuestionKind[] = DEFAULT_WSI_KINDS
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

        // The viewer is our own OpenSeadragon, so a case has to be openable in it:
        // either it ships a Deep Zoom manifest (PathPresenter, whose `url` is a Vue
        // page rather than a slide), or its repository is one the tile-source
        // resolver can open from the slide URL alone (the curated haematolymphoid
        // cases — Leeds, WHO, MGH and the rest). A case that is neither could only
        // be shown in someone else's iframe, so it is not a question we can ask.
        {
          const renderable = finalWSIData.filter(
            (slide) => Boolean(slide.tileSourceUrl) || isViewerSupported(slide.repository || "")
          );
          if (renderable.length === 0) {
            throw new Error(
              "No slides in this corpus carry a tile source — the viewer has nothing to render."
            );
          }
          finalWSIData = renderable;
        }

        // Only slides that can carry at least ONE of the enabled kinds. Diagnosis
        // accepts everything; IHC and molecular need the case to record the answer,
        // which roughly half and a third of the corpus respectively do. Which kind a
        // given slide actually gets is decided after it is picked (chooseKind), so
        // enabling IHC alone narrows the pool while enabling it alongside diagnosis
        // does not.
        const active = kinds.length > 0 ? kinds : DEFAULT_WSI_KINDS;
        if (!active.includes("diagnosis")) {
          const eligible = finalWSIData.filter((slide) =>
            active.some((k) => slideSupportsKind(slide, k))
          );
          if (eligible.length === 0) {
            throw new Error(
              active.length === 1
                ? `No slides in this corpus record ${active[0] === "ihc" ? "an immunoprofile" : "molecular findings"}.`
                : "No slides in this corpus record the findings these question types need."
            );
          }
          finalWSIData = eligible;
        }

        // Step 1: Select WSI using simplified approach with history tracking
        log.debug(
          `[WSI Generator] Step 1 - Selecting WSI from ${finalWSIData.length} available slides...`
        );
        let selectedWSI: VirtualSlide;
        // Slides already tried this round. The server now rejects a question that
        // narrates the slide, names the entity, or builds immunophenotype options
        // from different marker sets — and on a handful of cases every model in
        // the chain fails the same way (an entity whose name is unavoidable in a
        // clinical stem, say). That used to surface as "generation failed". A
        // different slide almost always succeeds, so try one before giving up.
        const attempted = new Set<string>();
        // Only when someone is waiting. A prefetch has no reader to disappoint,
        // and it is identified by the absence of the slide callback (it must stay
        // invisible, so it never publishes a slide); spending three model calls
        // on one would just eat the rate limit the prefetch exists to protect.
        const MAX_SLIDE_ATTEMPTS = onSlideSelected ? 3 : 1;
        let questionData: QuestionGenerationResponse | null = null;

        // Get history tracker
        const historyTracker = getWSIHistoryTracker();
        const effectiveCategory = category || "all";
        const recentIds = historyTracker.getRecentIds(effectiveCategory);

        log.debug(
          `[WSI Generator] Recent history size for "${effectiveCategory}": ${recentIds.length} slides`
        );

        // Kept so a run that exhausts the pool can still report why the last
        // attempt failed, rather than a generic "Failed to generate question".
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= MAX_SLIDE_ATTEMPTS; attempt++) {
          const attemptPool = finalWSIData.filter((slide) => !attempted.has(slide.id));
          if (attemptPool.length === 0) break;

          if (category && category !== "all") {
            // Filter by category first
            const categorySlides = attemptPool.filter((slide) =>
              slideMatchesCategory(slide.category, category)
            );

            if (categorySlides.length === 0) {
              // Nearly always the question types rather than the category: the
              // curated haematolymphoid cases record no immunoprofile and no
              // molecular findings, so with only IHC or Molecular switched on the
              // pool is emptied before the category is even applied. Name the
              // knob that fixes it — "no slides found" sends the reader hunting
              // through categories that are all equally empty.
              const missingBecauseOfKinds = !active.includes("diagnosis");
              const kindNames = active.map((k) => KIND_LABELS[k]).join(" or ");
              throw new Error(
                missingBecauseOfKinds
                  ? `No ${category} slides can carry ${kindNames} questions — those cases record no immunoprofile or molecular findings. Switch Diagnosis on to include them.`
                  : `No slides found for category: ${category}.`
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
            let availableSlides = attemptPool.filter((slide) => !recentIds.includes(slide.id));

            // If all slides have been shown, reset and use all slides
            if (availableSlides.length === 0) {
              log.debug(
                `[WSI Generator] All ${attemptPool.length} slides have been shown. Resetting history.`
              );
              historyTracker.clearAll();
              availableSlides = attemptPool;
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

          // The slide is chosen first, then the kind from what it can support: the
          // other order would reject most slides for most kinds.
          const kind = chooseKind(selectedWSI, active);
          attempted.add(selectedWSI.id);
          try {
            // Molecular distractors are drawn from other entities in the same
            // chapter rather than invented: supplying the material is what keeps a
            // breast question from offering leukaemia translocations.
            questionData = await requestQuestion(
              selectedWSI,
              kind,
              kind === "molecular" ? candidateAlterations(finalWSIData, selectedWSI) : []
            );
            if (!questionData.success || !questionData.question) {
              throw new Error("Failed to generate question");
            }
            break;
          } catch (attemptError) {
            lastError = attemptError;
            const message =
              attemptError instanceof Error ? attemptError.message : String(attemptError);
            // A dead session is not the slide's fault and no other slide will fix
            // it — surface it immediately rather than burning two more calls.
            if (/session has expired/i.test(message) || attempt === MAX_SLIDE_ATTEMPTS) {
              throw attemptError;
            }
            log.warn(
              `[WSI Generator] Attempt ${attempt} failed on "${selectedWSI.diagnosis}" (${message}); trying another slide`
            );
          }
        }

        if (!questionData?.question) {
          if (lastError) throw lastError;
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
            event_id: (questionData.metadata?.event_id as string | null | undefined) ?? null,
          },
          debug: questionData.debug as { prompt: string; instructions: string } | null | undefined,
        };

        // NOT recorded in history here. A prefetch that is later orphaned — the
        // reader changed category or question type before consuming it — would
        // otherwise mark a slide "recently shown" that nobody ever saw, and
        // exclude it from future draws. History is written when a question is
        // actually delivered (see generateQuestion).
        return generatedQuestion;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // A prefetch that fails is invisible and self-healing: nobody is waiting
        // on it, and the next real request generates fresh. Logging it at error
        // level put a red console entry in front of the reader for something that
        // did not affect them — while the question they DID ask for had already
        // succeeded on a retry.
        if (onSlideSelected) {
          log.error("[WSI Generator] Generation failed:", message);
        } else {
          log.warn("[WSI Generator] Prefetch failed (no reader waiting):", message);
        }
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
    (category?: string, kinds: WsiQuestionKind[] = DEFAULT_WSI_KINDS) => {
      // Keyed on category AND the enabled kinds: a prefetched diagnosis question is not a
      // valid answer to a request for an IHC one.
      const key = prefetchKey(category, kinds);
      if (prefetchRef.current?.category === key) return;
      const promise = produceQuestion(category, undefined, kinds);
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
    async (
      category?: string,
      kinds: WsiQuestionKind[] = DEFAULT_WSI_KINDS
    ): Promise<GeneratedQuestion> => {
      const key = prefetchKey(category, kinds);
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
            question = await produceQuestion(category, setPendingSlide, kinds);
          }
        } else {
          question = await produceQuestion(category, setPendingSlide, kinds);
        }
        // Recorded now, because now is when the reader sees it — a question
        // generated by a prefetch and then discarded never reaches this line.
        if (question.wsi?.id) {
          getWSIHistoryTracker().addToHistory(question.wsi.id, category || "all");
        }

        // Line up the next one while the reader works through this one.
        startPrefetch(category, kinds);
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
