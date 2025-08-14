// src/shared/components/common/demo-question.tsx
'use client'

import { useState, useEffect, useRef } from "react"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Check, X, ExternalLink } from "lucide-react"
import QuestionSkeleton from "./skeletons/demo-question-skeleton"
import DemoQuestionError from "./demo-question-error"
import { ImageCarousel } from "@/features/images/components/image-carousel"
import { useDemoQuestions } from "@/shared/hooks/use-demo-questions"

export default function DemoQuestion() {
  const { currentQuestion, loading, refreshQuestion, error } = useDemoQuestions();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when changing questions (simplified)
  useEffect(() => {
    if (currentQuestion) {
      setSelectedOption(null);
      setIsAnswered(false);
      setShowExplanation(false);
    }
  }, [currentQuestion]);

  // Handle scrolling when loading completes and we have a new question
  useEffect(() => {
    if (!loading && currentQuestion && shouldScrollToTop && containerRef.current) {
      // Get the element's position and scroll to slightly above it
      const elementTop = containerRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementTop - 60; // 60px above the element
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      setShouldScrollToTop(false);
    }
  }, [loading, currentQuestion, shouldScrollToTop]);

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      // Short delay before showing explanation for animation
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  const resetQuestion = () => {
    setShowExplanation(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setShouldScrollToTop(true); // Set flag to scroll after question loads
    refreshQuestion();
  };

  // Helper to get a letter label for an option ID
  const getOptionLabel = (optionId: string, index: number) => {
    // For UUIDs or long IDs, use alphabetical labels based on index
    if (optionId.length > 10) {
      return String.fromCharCode(65 + index); // A, B, C, D, etc.
    }
    // Otherwise just use the first character
    return optionId.toString().charAt(0).toUpperCase();
  };

  if (loading) return <QuestionSkeleton />;

  if (error && !currentQuestion) {
    return <DemoQuestionError message={error} onRetry={refreshQuestion} />;
  }

  if (!currentQuestion) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">❌ No Question Available</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>loading: {loading.toString()}</div>
              <div>currentQuestion: {currentQuestion ? 'exists' : 'null'}</div>
              <div>error: {error || 'none'}</div>
            </div>
            <Button onClick={refreshQuestion} className="mt-4">Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-4xl mx-auto"
      style={{ minHeight: '600px' }} // Consistent minimum height
    >
      <Card className="h-full">
        <CardContent className="space-y-4 pt-6">
          <div className="text-sm text-foreground/90">
            {currentQuestion.body}
          </div>

          {/* Images */}
          {currentQuestion.images && currentQuestion.images.length > 0 && (
            <div>
              <ImageCarousel
                images={currentQuestion.images}
                className="border rounded-lg"
              />
            </div>
          )}

        <div className="grid gap-2" role="listbox" aria-label="Answer options">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const showCorrect = isAnswered && option.correct;
            const showIncorrect = isAnswered && isSelected && !option.correct;
            // Calculate option letter label
            const optionLabel = getOptionLabel(option.id, index);

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`
                  p-2 rounded-md text-left border text-sm transition-colors duration-200
                  ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                  ${isSelected ? 'border-primary' : 'border'}
                  ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                  ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                `}
                disabled={isAnswered}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2">
                  <span className={`
                    flex items-center justify-center w-5 h-5 rounded-full border text-xs
                    ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                    ${showCorrect ? 'border-green-500' : ''}
                    ${showIncorrect ? 'border-red-500' : ''}
                  `}>
                    {optionLabel}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`transform transition-all duration-500 ${
            showExplanation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                <div className="text-muted-foreground">
                  {currentQuestion.teachingPoint}
                </div>
              </div>

              {/* Comparative Image - Only show if available */}
              {currentQuestion.comparativeImage && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Reference Chart</h4>
                  <ImageCarousel
                    images={[{
                      url: currentQuestion.comparativeImage.url,
                      alt: currentQuestion.comparativeImage.alt,
                      caption: currentQuestion.comparativeImage.caption
                    }]}
                    className="bg-white border rounded-lg"
                  />
                  {currentQuestion.comparativeImage.caption && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {currentQuestion.comparativeImage.caption}
                    </div>
                  )}
                </div>
              )}

              {/* Incorrect Explanations */}
              {currentQuestion.incorrectExplanations &&
               Object.keys(currentQuestion.incorrectExplanations).length > 0 && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Incorrect Answer Explanations</h4>
                  <div className="space-y-2 text-muted-foreground">
                    {Object.entries(currentQuestion.incorrectExplanations)
                      .filter(([id]) => {
                        // Get the correct option ID
                        const correctOptionId = currentQuestion.options.find(opt => opt.correct)?.id;
                        // Filter out the selected option and the correct answer
                        return selectedOption !== id && id !== correctOptionId;
                      })
                      .map(([id, explanation]) => (
                        <div key={id} className="flex gap-2">
                          <span className="font-medium">{getOptionLabel(id, currentQuestion.options.findIndex(opt => opt.id === id))}.</span>
                          <span>{explanation}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* References */}
              {currentQuestion.references && currentQuestion.references.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <h4 className="font-medium uppercase mb-1">References</h4>
                  <ul className="space-y-1">
                    {currentQuestion.references.map((ref, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="break-words">
                          {ref}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={resetQuestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Try Another
                </Button>
              </div>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}