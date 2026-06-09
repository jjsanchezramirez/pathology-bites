// src/features/quiz/components/quiz-question-display.tsx

"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ImageCarousel } from "@/shared/components/media/image-carousel";
import { ReferencesList } from "@/shared/components/common/references-list";
import { FakeSelectionHighlight } from "@/shared/components/common/fake-selection-highlight";
import { QuestionMarkdown } from "@/shared/components/common/question-markdown";
import { SlideViewerModal } from "@/shared/components/common/slide-viewer-modal";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import { Check, X, AlertTriangle, Highlighter } from "lucide-react";

function StrikeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" className={className} aria-hidden="true">
      <text
        x="14"
        y="17"
        textAnchor="middle"
        fontSize="16"
        fontWeight="600"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        abc
      </text>
      <line
        x1="0.5"
        y1="12.5"
        x2="27.5"
        y2="12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
import { UIQuizQuestion } from "@/features/user/quiz/types/quiz-question";
import { QuestionWithDetails } from "@/shared/types/questions";

interface QuizQuestionDisplayProps {
  question: UIQuizQuestion | QuestionWithDetails;
  questionNumber: number;
  totalQuestions: number;
  textZoom: number;
  mode: "tutor" | "practice";
  selectedAnswerId: string | null;
  onAnswerSelect: (answerId: string) => void;
  showExplanation: boolean;
  isReviewMode: boolean;
  struckAnswerIds?: Set<string>;
  onStrikeToggle?: (answerId: string) => void;
  /**
   * Optional renderer for the teaching point. When provided, replaces the
   * default plain-text rendering — used by the debug "Explanation Playground"
   * to inject a markdown + custom-directive renderer.
   */
  teachingPointRenderer?: (text: string) => React.ReactNode;
}

const LONG_PRESS_MS = 500;

export function QuizQuestionDisplay({
  question,
  questionNumber: _questionNumber,
  totalQuestions: _totalQuestions,
  textZoom: _textZoom,
  mode: _mode,
  selectedAnswerId,
  showExplanation,
  onAnswerSelect,
  isReviewMode,
  struckAnswerIds,
  onStrikeToggle,
  teachingPointRenderer,
}: QuizQuestionDisplayProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const strikesEnabled = !isReviewMode && !showExplanation && !!onStrikeToggle;

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  // Use question_options (the correct field for quiz display)
  const answerOptions = question.question_options || [];

  // Helper to get image data from either UIQuizQuestion or QuestionWithDetails format
  const getImageData = (qi: unknown) => {
    // UIQuizQuestion format: { image?: { id, url, alt_text, description } }
    // QuestionWithDetails format: { images?: { id, url, alt_text, description } }
    const imageData = (qi as { image?: unknown }).image || (qi as { images?: unknown }).images;
    return {
      id: (imageData as { id?: string })?.id || "",
      url: (imageData as { url?: string })?.url || "",
      alt_text: (imageData as { alt_text?: string })?.alt_text,
      description: (imageData as { description?: string })?.description,
    };
  };

  // Helper to get a letter label for an option ID
  const getOptionLabel = (optionId: string, index: number): string => {
    if (optionId.length > 10) {
      return String.fromCharCode(65 + index); // A, B, C, D, etc.
    }
    return optionId.toString().charAt(0).toUpperCase();
  };

  // Memoize image arrays and reset keys to prevent unnecessary carousel resets
  // Only recompute when question.id or question_images change
  const stemImages = useMemo(() => {
    if (!question.question_images || question.question_images.length === 0) return [];
    return question.question_images
      .filter((qi) => qi.question_section === "stem")
      .map((qi) => {
        const img = getImageData(qi);
        return {
          id: img.id,
          url: img.url,
          alt: img.alt_text || img.description || "Question image",
          caption: img.description || undefined,
        };
      });
  }, [question.question_images]);

  const explanationImages = useMemo(() => {
    if (!question.question_images || question.question_images.length === 0) return [];
    return question.question_images
      .filter((qi) => qi.question_section === "explanation")
      .map((qi) => {
        const img = getImageData(qi);
        return {
          id: img.id,
          url: img.url,
          alt: img.alt_text || img.description || "Reference image",
          caption: img.description || undefined,
        };
      });
  }, [question.question_images]);

  // Memoize reset keys to ensure stable references
  const stemResetKey = useMemo(() => `stem-${question.id}`, [question.id]);
  const explanationResetKey = useMemo(() => `explanation-${question.id}`, [question.id]);

  const questionStatus = (question as { status?: string }).status;
  const isFlaggedQuestion = !!questionStatus && questionStatus !== "published";

  // Highlight → look-up: select any term in the question/explanation to open Google Images,
  // the Slide Search, or — when it matches a known slide — the in-house WSI viewer inline.
  // Corpus loads lazily (module + HTTP cached). Answer buttons are skipped while answering so
  // tap-to-answer / strike keep working; their text becomes selectable once answered.
  const allSlides = useAllVirtualSlides();
  const [viewerSlide, setViewerSlide] = useState<VirtualSlide | null>(null);

  return (
    <>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Status banner: question was flagged/archived/etc. after this user answered it.
            Shown so the user doesn't see misleading "right answer" content as authoritative. */}
          {isFlaggedQuestion && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-foreground">
                This question has been flagged for review. The content or correct answer may be
                revised.
              </span>
            </div>
          )}

          {/* Question Stem — own selection container so a drag stays within the stem.
              Keyed by question.id so per-question highlights/selection reset on navigation
              instead of bleeding onto the next question's text. */}
          <FakeSelectionHighlight
            key={`fsh-stem-${question.id}`}
            allSlides={allSlides}
            onViewSlide={setViewerSlide}
          >
            <div>
              <QuestionMarkdown className="text-muted-foreground">{question.stem}</QuestionMarkdown>
            </div>
          </FakeSelectionHighlight>

          {/* Question Stem Images — not selectable */}
          {stemImages.length > 0 && (
            <div>
              <ImageCarousel
                images={stemImages}
                className="border rounded-lg"
                resetKey={stemResetKey}
              />
            </div>
          )}

          {/* Answer Options — own selection container: drag stays within options, selecting
                one highlights only its text (not the box), never the stem/explanation/WSI. */}
          <FakeSelectionHighlight
            key={`fsh-options-${question.id}`}
            allSlides={allSlides}
            onViewSlide={setViewerSlide}
          >
            <div className="grid gap-2" role="listbox" aria-label="Answer options">
              {answerOptions?.map((option, index) => {
                const isSelected = selectedAnswerId === option.id;
                const showCorrect = showExplanation && option.is_correct;
                const showIncorrect = showExplanation && isSelected && !option.is_correct;
                const isStruck = struckAnswerIds?.has(option.id) ?? false;
                const optionLabel = getOptionLabel(option.id, index);

                const handleClick = () => {
                  if (showExplanation) return;
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  onAnswerSelect(option.id);
                };

                const handleContextMenu = (e: React.MouseEvent) => {
                  if (!strikesEnabled) return;
                  e.preventDefault();
                  onStrikeToggle!(option.id);
                };

                const handleTouchStart = () => {
                  if (!strikesEnabled) return;
                  longPressFiredRef.current = false;
                  longPressTimerRef.current = setTimeout(() => {
                    longPressFiredRef.current = true;
                    onStrikeToggle!(option.id);
                  }, LONG_PRESS_MS);
                };

                const showStrikeForOption = isStruck && !showCorrect && !showIncorrect;

                return (
                  <button
                    key={option.id}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    // aria-disabled (not `disabled`) once answered: clicks are already no-ops
                    // via handleClick's guard, and a real disabled button blocks text selection,
                    // so this keeps the option's diagnosis selectable for look-up in review.
                    aria-disabled={showExplanation}
                    {...(showExplanation ? {} : { "data-no-highlight": "" })}
                    className={`
                  w-full p-3 text-left border rounded-lg transition-colors ${showExplanation ? "" : "select-none"}
                  ${isSelected && !showExplanation ? "border-blue-500 bg-blue-500/10" : "border-gray-200"}
                  ${showCorrect ? "border-green-500 bg-green-500/5" : ""}
                  ${showIncorrect ? "border-red-500 bg-red-500/5" : ""}
                  ${!showExplanation ? "hover:border-gray-300 cursor-pointer" : "cursor-default"}
                `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center gap-3 flex-1 min-w-0 ${showStrikeForOption ? "opacity-50 line-through" : ""}`}
                      >
                        <span
                          data-no-highlight=""
                          className={`
                      flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium no-underline
                      ${isSelected && !showExplanation ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300"}
                      ${showCorrect ? "border-green-600 bg-green-600 text-white" : ""}
                      ${showIncorrect ? "border-red-600 bg-red-600 text-white" : ""}
                    `}
                        >
                          {optionLabel}
                        </span>
                        <span className="flex-1">
                          <QuestionMarkdown inline>{option.text}</QuestionMarkdown>
                        </span>
                      </div>
                      {showCorrect && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {showIncorrect && <X className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      {strikesEnabled && (
                        <span
                          role="button"
                          tabIndex={0}
                          data-no-highlight=""
                          aria-label={isStruck ? "Remove strike from option" : "Strike out option"}
                          aria-pressed={isStruck}
                          title={
                            isStruck
                              ? "Remove strike (right-click or long-press)"
                              : "Strike out (right-click or long-press)"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onStrikeToggle!(option.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              onStrikeToggle!(option.id);
                            }
                          }}
                          className={`
                        flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer
                        ${isStruck ? "text-accent-foreground bg-accent hover:bg-accent/80" : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"}
                      `}
                        >
                          <StrikeIcon className="w-6 h-6" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </FakeSelectionHighlight>

          {/* Explanation Section — own selection container */}
          {showExplanation && (
            <div className="p-4 rounded-lg bg-muted/50 text-sm">
              <FakeSelectionHighlight
                key={`fsh-expl-${question.id}`}
                allSlides={allSlides}
                onViewSlide={setViewerSlide}
                className="space-y-4"
              >
                {/* Teaching Point */}
                {question.teaching_point && (
                  <div>
                    <h4 className="font-medium text-xs uppercase mb-2">Teaching Point</h4>
                    {teachingPointRenderer ? (
                      // A custom renderer injects interactive widgets (markdown editor, Anki
                      // embeds, explainer player, Ask-AI). They must opt out of the fake-selection
                      // surface above — it sets userSelect:none and hijacks pointer/contextmenu,
                      // so without this every click/scrub/keystroke is swallowed (this is what
                      // broke the Explanation Playground). Plain-text teaching points have no
                      // interactive children, so they stay inside the selectable surface.
                      <div data-no-highlight>{teachingPointRenderer(question.teaching_point)}</div>
                    ) : (
                      <QuestionMarkdown className="text-muted-foreground">
                        {question.teaching_point}
                      </QuestionMarkdown>
                    )}
                  </div>
                )}

                {/* Individual Option Explanations (exclude correct answer — covered by teaching point) */}
                {answerOptions?.some((opt) => opt.explanation && !opt.is_correct) && (
                  <div>
                    <h4 className="font-medium text-xs uppercase mb-2">
                      Incorrect Answer Explanations
                    </h4>
                    <div className="space-y-2 text-muted-foreground">
                      {answerOptions
                        ?.filter((opt) => opt.explanation && !opt.is_correct)
                        .map((option, index) => (
                          <div key={option.id} className="flex gap-2">
                            <span className="font-medium">
                              {getOptionLabel(
                                option.id,
                                answerOptions?.findIndex((opt) => opt.id === option.id) || index
                              )}
                              .
                            </span>
                            <span>
                              <QuestionMarkdown inline>{option.explanation}</QuestionMarkdown>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Explanation Images */}
                {explanationImages.length > 0 && (
                  <div>
                    <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                    <div data-no-highlight>
                      <ImageCarousel
                        images={explanationImages}
                        className="bg-white border rounded-lg"
                        resetKey={explanationResetKey}
                      />
                    </div>
                  </div>
                )}

                {/* References */}
                {question.question_references && (
                  <ReferencesList references={question.question_references} />
                )}
              </FakeSelectionHighlight>
            </div>
          )}

          {/* Feature hint — highlight any term to look it up / open an example slide. Hidden on
              touch devices, where the highlight/selection feature is disabled (see
              FakeSelectionHighlight's coarse-pointer gate). */}
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
        </CardContent>
      </Card>
      <SlideViewerModal slide={viewerSlide} onClose={() => setViewerSlide(null)} />
    </>
  );
}
