"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { AlertCircle, RefreshCw, Loader2, Highlighter } from "lucide-react";
import { WSIQuestionViewer } from "./wsi-question-viewer";
import { LoadingNote, OptionsSkeleton, StemSkeleton } from "./wsi-loading-parts";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import { toast } from "@/shared/utils/ui/toast";
import { WsiFullscreenShell } from "./wsi-fullscreen-shell";
import { FakeSelectionHighlight } from "@/shared/components/common/fake-selection-highlight";
import { SlideViewerModal } from "@/shared/components/common/slide-viewer-modal";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";

// Import client-side hook for WSI question generation
import {
  useWSIQuestionGenerator,
  type GeneratedQuestion,
} from "@/shared/hooks/use-wsi-question-generator";

// Import the canonical VirtualSlide interface
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { log } from "@/shared/utils/logging";
import {
  LOADING_MESSAGES,
  categoriesWithoutKinds,
  ensureWSIRepository,
  extractCategories,
} from "./wsi-question-generator-utils";
import { WSIGeneratorSkeleton } from "./wsi-generator-skeleton";
import { WSIGeneratorControls } from "./wsi-generator-controls";
import { WSISlideCredits } from "./wsi-slide-credits";
import { WSIAnswerOptions } from "./wsi-answer-options";
import { WSIExplanation } from "./wsi-explanation";
import {
  DEFAULT_WSI_KINDS,
  WSI_QUESTION_KINDS,
  WSI_KINDS_STORAGE_KEY,
  type WsiQuestionKind,
} from "@/features/user/wsi-questions/utils/wsi-question-kinds";
import {
  hydrateWsiLayout,
  setWsiLayout,
  useWsiLayout,
} from "@/features/user/wsi-questions/utils/wsi-layout";

interface WSIQuestionGeneratorProps {
  className?: string;
  showCategoryFilter?: boolean;
  compact?: boolean;
}

export function WSIQuestionGenerator({
  className = "",
  showCategoryFilter = true,
  compact: _compact = false,
}: WSIQuestionGeneratorProps) {
  // Use the new client-side hook for WSI question generation
  const {
    generateQuestion,
    isGenerating,
    error,
    clearError,
    isWSIDataLoading,
    isReady,
    pendingSlide,
    startPrefetch,
  } = useWSIQuestionGenerator();

  const [currentQuestion, setCurrentQuestion] = useState<GeneratedQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // Highlight → look-up: select a term in the stem/explanation to open Google Images, the Slide
  // Search, or the in-house WSI viewer inline. Corpus loads lazily (module + HTTP cached).
  const allSlides = useAllVirtualSlides();
  const [lookupSlide, setLookupSlide] = useState<VirtualSlide | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  // A set, not one choice: mixed practice is the normal case. Persisted, because
  // it is a standing preference like the layout, not part of a question.
  const [questionKinds, setQuestionKinds] = useState<WsiQuestionKind[]>(DEFAULT_WSI_KINDS);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WSI_KINDS_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as unknown) : null;
      const valid = Array.isArray(parsed)
        ? parsed.filter((k): k is WsiQuestionKind =>
            WSI_QUESTION_KINDS.some((known) => known.id === k)
          )
        : [];
      if (valid.length) setQuestionKinds(valid);
    } catch {
      // Bad JSON or no storage — the default set is fine.
    }
  }, []);
  const changeKinds = useCallback((next: WsiQuestionKind[]) => {
    setQuestionKinds(next);
    try {
      window.localStorage.setItem(WSI_KINDS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing — the preference just won't persist.
    }
  }, []);
  // Layout is a reading preference, not question state, and the page needs the
  // same answer (it drops its heading and asks the shell to collapse), so it
  // lives in a module store rather than here. Persisting is the store's job.
  const layout = useWsiLayout();
  useEffect(hydrateWsiLayout, []);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState("");
  const [_loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Which request the reader is actually waiting for. Disabling the picker mid
  // generation closes the common path, but a keyboard-driven change or a toggle
  // can still overlap — and whichever request resolves LAST would otherwise set
  // the question, regardless of which one the reader asked for.
  const requestToken = useRef(0);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Extract categories directly from client-side WSI data (like virtual slides page)
  const { wsiData } = useWSIQuestionGenerator();

  useEffect(() => {
    if (!showCategoryFilter || !wsiData) return;
    setAvailableCategories(extractCategories(wsiData));
  }, [showCategoryFilter, wsiData]);

  // Categories the enabled question types cannot draw from. Computed with the
  // same renderability rule the generator uses, so the picker and the pool agree.
  const unavailableCategories = useMemo(
    () =>
      wsiData
        ? categoriesWithoutKinds(wsiData, questionKinds, (slide) =>
            Boolean(slide.tileSourceUrl || isViewerSupported(slide.repository || ""))
          )
        : [],
    [wsiData, questionKinds]
  );

  const generateNewQuestion = useCallback(
    async (categoryOverride?: string) => {
      setSlideUnavailable(null);
      // Scroll to the main content section (bottom of hero) immediately when button is clicked
      const contentSection = document.getElementById("wsi-content");
      if (contentSection) {
        contentSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Reset state for new question generation
      setSelectedOption(null);
      setIsAnswered(false);
      setShowExplanation(false);
      clearError();

      // The override exists because a category change has to generate with the
      // category the reader JUST picked: setState has not committed yet when the
      // handler runs, so reading state here would use the previous one.
      const category = categoryOverride ?? selectedCategory;
      const token = ++requestToken.current;

      try {
        const question = await generateQuestion(
          category === "all" ? undefined : category,
          questionKinds
        );

        // Ensure the WSI has the repository field (in case the API response doesn't include it)
        const questionWithRepository: GeneratedQuestion = question.wsi
          ? {
              ...question,
              wsi: ensureWSIRepository(question.wsi),
            }
          : question;

        // A superseded request drops its result on the floor.
        if (token !== requestToken.current) {
          log.debug("[WSI Generator] Discarding a superseded question");
          return;
        }
        setCurrentQuestion(questionWithRepository);
      } catch (err) {
        log.error("Error generating question:", err);
        // Error state is managed by the hook
      }
    },
    [generateQuestion, selectedCategory, questionKinds, clearError]
  );

  const prefetchedCategory = useRef<string | null>(null);

  // A failed REFRESH must not cost the reader the question they were working on.
  // The error branch below takes over the whole view, which is right when there
  // is nothing to show — and wrong when a slide and question are already on
  // screen: three failed attempts would clear the case mid-read.
  useEffect(() => {
    if (!error || !currentQuestion) return;
    const rateLimited = /429|too many requests|rate limit/i.test(error);
    toast.error(
      rateLimited
        ? "Couldn't fetch a new question — the AI service is rate limited. Try again shortly."
        : "Couldn't fetch a new question. Your current one is still here.",
      { duration: 6000 }
    );
    clearError();
  }, [error, currentQuestion, clearError]);

  // A question whose slide will not load is unanswerable, and the reader should
  // not have to work out that the blank frame is the problem. Rare — the pool is
  // filtered to openable slides — but a tile host can be down at read time.
  // The last slide shown, so the pending → question hand-off cannot fall through
  // a render with neither set. Read where `activeSlide` is derived, below; up
  // here only because hooks cannot live past the early returns.
  const lastSlide = useRef<VirtualSlide | null>(null);

  const [slideUnavailable, setSlideUnavailable] = useState<string | null>(null);
  const handleSlideUnavailable = useCallback((message: string) => {
    setSlideUnavailable(message);
  }, []);

  // Callers that are just "generate another" (buttons, Try Again) must not pass
  // their click event in as a category.
  const newQuestion = useCallback(() => generateNewQuestion(), [generateNewQuestion]);

  // Changing the category should show a question from it right away — asking the
  // reader to then press New question is a second step for something they have
  // already asked for. "All categories" is excluded: it is the state you pass
  // through on the way somewhere else, and refreshing there discards the question
  // on screen for no gain.
  const changeCategory = useCallback(
    (next: string) => {
      setSelectedCategory(next);
      if (next === "all") return;
      // Claim the prefetch scope so the effect below sees no change and stays
      // quiet: this generation already warms the next one.
      prefetchedCategory.current = `${next}|${[...questionKinds].sort().join(",")}`;
      void generateNewQuestion(next);
    },
    [generateNewQuestion, questionKinds]
  );

  // Auto-generate first question on component mount - use ref to prevent infinite loops
  const hasAutoGenerated = useRef(false);

  // The pending prefetch is keyed by category, so switching categories throws it
  // away and the next question pays full latency. Start warming the new category
  // as soon as the user picks it — by the time they hit "New question" it is
  // usually ready.
  //
  // Only on an actual change: on mount this would race the auto-generate below
  // (which has not set isGenerating yet in the same commit) and fire two
  // concurrent generations, doubling the opening burst against a 5 RPM limit.

  // Sorted so the effect doesn't refire when only the toggle ORDER changed.
  const prefetchScope = `${selectedCategory}|${[...questionKinds].sort().join(",")}`;
  useEffect(() => {
    if (!isReady || isWSIDataLoading) return;
    if (prefetchedCategory.current === null) {
      // adopt the initial value, don't act on it
      prefetchedCategory.current = prefetchScope;
      return;
    }
    if (prefetchedCategory.current === prefetchScope) return;
    prefetchedCategory.current = prefetchScope;
    startPrefetch(selectedCategory === "all" ? undefined : selectedCategory, questionKinds);
  }, [prefetchScope, selectedCategory, questionKinds, isReady, isWSIDataLoading, startPrefetch]);

  useEffect(() => {
    // Only auto-generate if:
    // 1. We haven't auto-generated yet
    // 2. No current question exists
    // 3. Not currently generating
    // 4. No error state
    // 5. WSI data is ready (not loading and has data)
    if (
      !hasAutoGenerated.current &&
      !currentQuestion &&
      !isGenerating &&
      !error &&
      isReady &&
      !isWSIDataLoading
    ) {
      hasAutoGenerated.current = true;
      generateNewQuestion();
    }
  }, [currentQuestion, isGenerating, error, isReady, isWSIDataLoading, generateNewQuestion]); // Include all dependencies

  // Cycle through loading messages while generating
  useEffect(() => {
    if (isGenerating) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
      setLoadingMessageIndex(initialIndex);
      setCurrentLoadingMessage(LOADING_MESSAGES[initialIndex]);

      // Cycle through messages every 2 seconds for better visibility
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex((prev) => {
          const nextIndex = (prev + 1) % LOADING_MESSAGES.length;
          setCurrentLoadingMessage(LOADING_MESSAGES[nextIndex]);
          return nextIndex;
        });
      }, 2000);
    } else {
      // Clear interval when not loading
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isGenerating]);

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      // Short delay before showing explanation for animation
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  if (error && !currentQuestion) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-destructive">Error Loading Question</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={newQuestion} disabled={isGenerating}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Built above the early returns: the generating state renders the same bar,
  // so the controls do not jump or reset between states.
  const controls = (
    <WSIGeneratorControls
      showCategoryFilter={showCategoryFilter}
      availableCategories={availableCategories}
      unavailableCategories={unavailableCategories}
      selectedCategory={selectedCategory}
      onCategoryChange={changeCategory}
      questionKinds={questionKinds}
      onQuestionKindsChange={changeKinds}
      layout={layout}
      onLayoutChange={setWsiLayout}
      isGenerating={isGenerating}
      onNewQuestion={newQuestion}
      compact={layout === "fullscreen"}
    />
  );

  // The slide on screen, whichever phase we are in. While a question is being
  // written this is the pending slide (so its tiles load during generation
  // rather than after it); once the question lands it is the question's own —
  // the same object, so the viewer below never remounts on that transition.
  //
  // The third fallback closes a one-render gap between the two. They are owned
  // by different components and written in different microtasks: the hook clears
  // `pendingSlide` in its `finally`, and only then does the awaiting handler here
  // set `currentQuestion`. React batches those two today, so the gap never
  // commits — but that is a scheduling detail, not a guarantee, and if it ever
  // commits the viewer unmounts and every tile reloads. Holding the last slide
  // makes the hand-off structural instead of a bet on batching.
  const activeSlide = currentQuestion?.wsi ?? pendingSlide ?? lastSlide.current;
  // Derived, idempotent, and never read before it is written in the same render,
  // so assigning during render is safe here.
  lastSlide.current = activeSlide ?? null;

  // No slide at all yet: the corpus is still loading, or a prefetched question
  // is resolving without having published one.
  if (!activeSlide && (isGenerating || isWSIDataLoading)) {
    return (
      <WSIGeneratorSkeleton
        className={className}
        controls={controls}
        layout={layout}
        isWSIDataLoading={isWSIDataLoading}
        currentLoadingMessage={currentLoadingMessage}
      />
    );
  }

  // Nothing at all to show: no slide and no question, and nothing in flight.
  if (!activeSlide) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
        <Card className="h-full">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Initializing WSI Question Generator...</p>
              <p className="text-xs text-muted-foreground">Preparing your pathology challenge</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Safety check to ensure we have a valid question structure
  if (currentQuestion && (!currentQuestion.wsi || !currentQuestion.question)) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
        <Card className="h-full">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Invalid question data</p>
              <p className="text-xs text-muted-foreground">Please try generating a new question</p>
              <Button onClick={newQuestion} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The remaining pieces are shared by both layouts so the two can't drift apart.
  const stem = !currentQuestion ? null : (
    <FakeSelectionHighlight allSlides={allSlides} onViewSlide={setLookupSlide}>
      <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
        {currentQuestion.question.stem}
      </div>
    </FakeSelectionHighlight>
  );

  const options = !currentQuestion ? null : (
    <WSIAnswerOptions
      options={currentQuestion.question.options}
      selectedOption={selectedOption}
      isAnswered={isAnswered}
      onOptionClick={handleOptionClick}
      allSlides={allSlides}
      onViewSlide={setLookupSlide}
    />
  );

  const explanation = isAnswered && currentQuestion && (
    <WSIExplanation
      question={currentQuestion.question}
      metadata={currentQuestion.metadata}
      isGenerating={isGenerating}
      showExplanation={showExplanation}
      onNewQuestion={newQuestion}
      allSlides={allSlides}
      onViewSlide={setLookupSlide}
    />
  );

  const highlightHint = (
    <div data-no-highlight className="flex justify-center pt-1 pointer-coarse:hidden">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 px-3.5 py-1.5 text-xs text-primary shadow-sm">
        <Highlighter className="h-4 w-4 shrink-0" />
        <span>
          <strong className="font-semibold">Highlight</strong> any term to{" "}
          <strong className="font-semibold">search images</strong> or{" "}
          <strong className="font-semibold">view an example slide</strong>
        </span>
      </span>
    </div>
  );

  // Written once and used by both layouts, so the element — and therefore the
  // OpenSeadragon instance — is identical across the generating/answered
  // transition. Keyed on the slide, so a NEW slide does remount.
  const viewer = (
    <WSIQuestionViewer
      key={activeSlide.id}
      slide={activeSlide}
      fillHeight={layout === "fullscreen"}
      onUnavailable={handleSlideUnavailable}
    />
  );

  const unavailableNotice = slideUnavailable ? (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <span>{slideUnavailable} This question needs it, so try another.</span>
      <Button size="sm" variant="outline" onClick={newQuestion} disabled={isGenerating}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Another question
      </Button>
    </div>
  ) : null;

  // While the question is still being written, the panel holds its skeleton and
  // the rotating note; the slide beside it is already live.
  const panel = currentQuestion ? (
    <>
      {unavailableNotice}
      {stem}
      {options}
      {explanation}
      <WSISlideCredits wsi={activeSlide} />
    </>
  ) : (
    <>
      <LoadingNote currentLoadingMessage={currentLoadingMessage} compact />
      <StemSkeleton />
      <OptionsSkeleton />
      <WSISlideCredits wsi={activeSlide} />
    </>
  );

  if (layout === "fullscreen") {
    return (
      <WsiFullscreenShell className={className} controls={controls} viewer={viewer} panel={panel}>
        <SlideViewerModal slide={lookupSlide} onClose={() => setLookupSlide(null)} />
      </WsiFullscreenShell>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-4xl mx-auto ${className}`}
      style={{ minHeight: "600px" }}
    >
      {controls}

      <Card className="h-full">
        <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-3 sm:px-6">
          {currentQuestion ? (
            stem
          ) : (
            <>
              <LoadingNote currentLoadingMessage={currentLoadingMessage} compact />
              <StemSkeleton />
            </>
          )}

          {/* WSI Viewer — not selectable */}
          <div className="w-full">
            {viewer}
            <WSISlideCredits wsi={activeSlide} />
          </div>

          {unavailableNotice}
          {currentQuestion ? options : <OptionsSkeleton />}
          {explanation}
          {currentQuestion ? highlightHint : null}
          <SlideViewerModal slide={lookupSlide} onClose={() => setLookupSlide(null)} />
        </CardContent>
      </Card>
    </div>
  );
}
