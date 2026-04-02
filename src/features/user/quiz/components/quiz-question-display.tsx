// src/features/quiz/components/quiz-question-display.tsx

"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ImageCarousel } from "@/shared/components/media/image-carousel";
import { ReferencesList } from "@/shared/components/common/references-list";
import { Check, X } from "lucide-react";
import { UIQuizQuestion } from "@/features/user/quiz/types/quiz-question";
import { QuestionWithDetails } from "@/shared/types/questions";

interface QuizQuestionDisplayProps {
  question: UIQuizQuestion | QuestionWithDetails;
  questionNumber: number;
  totalQuestions: number;
  textZoom: number;
  mode: "tutor" | "exam" | "practice";
  selectedAnswerId: string | null;
  onAnswerSelect: (answerId: string) => void;
  showExplanation: boolean;
  isReviewMode: boolean;
}

export function QuizQuestionDisplay({
  question,
  questionNumber: _questionNumber,
  totalQuestions: _totalQuestions,
  textZoom: _textZoom,
  mode: _mode,
  selectedAnswerId,
  showExplanation,
  onAnswerSelect,
  isReviewMode: _isReviewMode,
}: QuizQuestionDisplayProps) {
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

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Question Stem */}
        <div>
          <p className="text-muted-foreground">{question.stem}</p>
        </div>

        {/* Question Stem Images */}
        {stemImages.length > 0 && (
          <div>
            <ImageCarousel
              images={stemImages}
              className="border rounded-lg"
              resetKey={stemResetKey}
            />
          </div>
        )}

        {/* Answer Options */}
        <div className="grid gap-2" role="listbox" aria-label="Answer options">
          {answerOptions?.map((option, index) => {
            const isSelected = selectedAnswerId === option.id;
            const showCorrect = showExplanation && option.is_correct;
            const showIncorrect = showExplanation && isSelected && !option.is_correct;
            const optionLabel = getOptionLabel(option.id, index);

            return (
              <button
                key={option.id}
                onClick={() => !showExplanation && onAnswerSelect(option.id)}
                disabled={showExplanation}
                className={`
                  w-full p-3 text-left border rounded-lg transition-colors
                  ${isSelected && !showExplanation ? "border-blue-500 bg-blue-500/10" : "border-gray-200"}
                  ${showCorrect ? "border-green-500 bg-green-500/5" : ""}
                  ${showIncorrect ? "border-red-500 bg-red-500/5" : ""}
                  ${!showExplanation ? "hover:border-gray-300 cursor-pointer" : "cursor-default"}
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`
                    flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium
                    ${isSelected && !showExplanation ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300"}
                    ${showCorrect ? "border-green-600 bg-green-600 text-white" : ""}
                    ${showIncorrect ? "border-red-600 bg-red-600 text-white" : ""}
                  `}
                  >
                    {optionLabel}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-600" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-600" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation Section */}
        {showExplanation && (
          <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-4">
            {/* Teaching Point */}
            {question.teaching_point && (
              <div>
                <h4 className="font-medium text-xs uppercase mb-2">Teaching Point</h4>
                <div className="text-muted-foreground">{question.teaching_point}</div>
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
                        <span>{option.explanation}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Explanation Images */}
            {explanationImages.length > 0 && (
              <div>
                <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                <ImageCarousel
                  images={explanationImages}
                  className="bg-white border rounded-lg"
                  resetKey={explanationResetKey}
                />
              </div>
            )}

            {/* References */}
            {question.question_references && (
              <ReferencesList references={question.question_references} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
