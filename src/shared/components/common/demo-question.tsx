// src/components/landing/demo-question.tsx
'use client'

import { useState, useEffect, useRef } from "react"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Check, X, ExternalLink } from "lucide-react"
import QuestionSkeleton from "./skeletons/demo-question-skeleton"
import DemoQuestionError from "./demo-question-error"
import { ImageCarousel } from "@/features/images/components/image-carousel"
import { ImprovedImageDialog } from "./improved-image-dialog"
import { useDemoQuestions } from "@/shared/hooks/use-demo-questions"

export default function DemoQuestion() {
  const { currentQuestion, loading, refreshQuestion, error } = useDemoQuestions();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Effect to handle animation timing after data loads
  useEffect(() => {
    if (!loading && currentQuestion) {
      // Short delay before showing content for animation
      const contentTimer = setTimeout(() => {
        setShowContent(true);
      }, 100);

      return () => clearTimeout(contentTimer);
    }
  }, [loading, currentQuestion]);

  // Reset state when changing questions
  useEffect(() => {
    if (currentQuestion) {
      setSelectedOption(null);
      setIsAnswered(false);
      setShowContent(false);
      setShowExplanation(false);
    }
  }, [currentQuestion?.id]); // Use question ID to detect actual changes

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      // Short delay before showing explanation for animation
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  const resetQuestion = () => {
    setIsTransitioning(true);

    // First hide content with animation
    setShowContent(false);
    setShowExplanation(false);

    // Reset all state
    setSelectedOption(null);
    setIsAnswered(false);

    // Fetch new question after animation
    setTimeout(() => {
      refreshQuestion();
      setIsTransitioning(false);
    }, 300);
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
    return <DemoQuestionError
      message="No questions available at this time."
      onRetry={refreshQuestion}
    />;
  }

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-4xl mx-auto transition-all duration-300 ease-in-out ${
        isTransitioning ? 'opacity-50' : 'opacity-100'
      }`}
      style={{ minHeight: '600px' }} // Consistent minimum height
    >
      <Card className="h-full">
        <CardHeader className="py-2">
          <CardTitle className={`text-lg transform transition-all duration-500 ${
            showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            {currentQuestion.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 transition-all duration-300 ease-in-out">
        <div className={`text-sm text-foreground/90 transform transition-all duration-500 delay-100 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {currentQuestion.body}
        </div>

        {/* Images */}
        {currentQuestion.images && currentQuestion.images.length > 0 && (
          <div className={`transform transition-all duration-500 delay-200 ${
            showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            {currentQuestion.images.length === 1 ? (
              <ImprovedImageDialog
                src={currentQuestion.images[0].url}
                alt={currentQuestion.images[0].alt}
                caption={currentQuestion.images[0].caption}
                className="border rounded-lg"
                aspectRatio="16/10"
              />
            ) : (
              <ImageCarousel
                images={currentQuestion.images}
                className="border rounded-lg"
              />
            )}
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
                  p-2 rounded-md text-left border text-sm transition-all duration-500
                  transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
                  ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                  ${isSelected ? 'border-primary' : 'border'}
                  ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                  ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                `}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
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
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="relative" style={{ aspectRatio: '16/10' }}>
                      <img
                        src={currentQuestion.comparativeImage.url}
                        alt={currentQuestion.comparativeImage.alt}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    {currentQuestion.comparativeImage.caption && (
                      <div className="p-2 text-xs text-muted-foreground">
                        {currentQuestion.comparativeImage.caption}
                      </div>
                    )}
                  </div>
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