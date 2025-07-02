'use client'

import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Check, X, ExternalLink, RefreshCw } from "lucide-react"
import { SimpleCarousel } from "./simple-carousel"
import { useDemoQuestions } from "@/shared/hooks/use-demo-questions"

// Simple loading skeleton
function LoadingSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="min-h-[600px]">
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
          <div className="h-48 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Simple error display
function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="min-h-[600px] flex items-center justify-center">
        <CardContent className="text-center space-y-4">
          <div className="text-red-500 text-lg font-medium">Error Loading Question</div>
          <p className="text-gray-600">{message}</p>
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DemoQuestionV2() {
  const { currentQuestion, loading, error, refreshQuestion } = useDemoQuestions()
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null)
    setShowResults(false)
    setIsVisible(false)

    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [currentQuestion?.id])

  const handleAnswerSelect = (optionId: string) => {
    if (showResults) return
    setSelectedAnswer(optionId)

    // Smooth transition to results
    setTimeout(() => {
      setShowResults(true)
    }, 150)
  }

  const handleNewQuestion = () => {
    setIsVisible(false)

    // Wait for fade out before changing question
    setTimeout(() => {
      setSelectedAnswer(null)
      setShowResults(false)
      refreshQuestion()
    }, 300)
  }

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index) // A, B, C, D, E
  }

  // Loading state
  if (loading) {
    return <LoadingSkeleton />
  }

  // Error state
  if (error || !currentQuestion) {
    return (
      <ErrorDisplay 
        message={error || "No questions available"} 
        onRetry={refreshQuestion} 
      />
    )
  }

  const correctOption = currentQuestion.options.find(opt => opt.correct)

  return (
    <div className={`w-full max-w-4xl mx-auto transition-all duration-500 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`}>
      <Card className="min-h-[600px] transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className={`text-lg font-medium transition-all duration-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            {currentQuestion.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Question text */}
          <div className={`text-sm text-gray-700 leading-relaxed transition-all duration-500 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            {currentQuestion.body}
          </div>

          {/* Images */}
          {currentQuestion.images && currentQuestion.images.length > 0 && (
            <div className={`transition-all duration-500 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}>
              <SimpleCarousel
                images={currentQuestion.images}
                className="w-full"
              />
            </div>
          )}

          {/* Answer options */}
          <div className={`space-y-2 transition-all duration-500 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === option.id
              const isCorrect = option.correct
              const showCorrect = showResults && isCorrect
              const showIncorrect = showResults && isSelected && !isCorrect

              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id)}
                  disabled={showResults}
                  style={{ animationDelay: `${index * 100}ms` }}
                  className={`
                    w-full p-3 text-left rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.01]
                    ${showCorrect
                      ? 'border-green-500 bg-green-50 text-green-800 scale-[1.02]'
                      : showIncorrect
                        ? 'border-red-500 bg-red-50 text-red-800 scale-[1.02]'
                        : isSelected
                          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                    ${showResults ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-300
                      ${showCorrect
                        ? 'border-green-500 bg-green-500 text-white'
                        : showIncorrect
                          ? 'border-red-500 bg-red-500 text-white'
                          : isSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-400'
                      }
                    `}>
                      {showCorrect ? (
                        <Check className="w-3 h-3" />
                      ) : showIncorrect ? (
                        <X className="w-3 h-3" />
                      ) : (
                        getOptionLabel(index)
                      )}
                    </div>
                    <span className="flex-1 text-sm">{option.text}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Results and explanation */}
          {showResults && (
            <div className="space-y-3 pt-4 border-t animate-in slide-in-from-bottom-4 duration-500">
              {/* Result message */}
              <div className={`p-3 rounded-lg transition-all duration-300 ${
                selectedAnswer === correctOption?.id
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className={`text-sm font-medium ${
                  selectedAnswer === correctOption?.id ? 'text-green-800' : 'text-red-800'
                }`}>
                  {selectedAnswer === correctOption?.id ? 'Correct!' : 'Incorrect'}
                </div>
                <div className={`text-xs mt-1 ${
                  selectedAnswer === correctOption?.id ? 'text-green-700' : 'text-red-700'
                }`}>
                  {selectedAnswer === correctOption?.id
                    ? `The correct answer is ${getOptionLabel(currentQuestion.options.findIndex(opt => opt.correct))}.`
                    : `The correct answer is ${getOptionLabel(currentQuestion.options.findIndex(opt => opt.correct))}.`
                  }
                </div>
              </div>

              {/* Teaching point */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg transition-all duration-300 delay-100">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Teaching Point</h4>
                <p className="text-blue-700 text-xs leading-relaxed">
                  {currentQuestion.teachingPoint}
                </p>
              </div>

              {/* Incorrect explanation if applicable */}
              {selectedAnswer && selectedAnswer !== correctOption?.id && currentQuestion.incorrectExplanations[selectedAnswer] && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg transition-all duration-300 delay-200">
                  <h4 className="text-sm font-medium text-orange-800 mb-2">Why this answer is incorrect</h4>
                  <p className="text-orange-700 text-xs leading-relaxed">
                    {currentQuestion.incorrectExplanations[selectedAnswer]}
                  </p>
                </div>
              )}

              {/* References */}
              {currentQuestion.references && currentQuestion.references.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg transition-all duration-300 delay-300">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">References</h4>
                  <ul className="space-y-1">
                    {currentQuestion.references.map((ref, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                        <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="break-all">{ref}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* New question button */}
              <div className="flex justify-center pt-3 transition-all duration-300 delay-400">
                <Button
                  onClick={handleNewQuestion}
                  className="px-6 py-2 text-sm transition-all duration-200 hover:scale-105"
                >
                  Try Another Question
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
