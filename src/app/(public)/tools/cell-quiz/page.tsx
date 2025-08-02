'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Check, X, RotateCcw, ArrowLeft, ArrowRight, ChevronRight, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { useCachedData } from '@/shared/hooks/use-cached-data'
import { generateLookAlikeOptions, generateBiologicalOptions } from '@/features/cell-quiz/data/cell-pathways'

interface Question {
  cellType: string
  imagePath: string
  options: string[]
  correctAnswer: string
  explanation: string
}

// Helper function to find reference cell info by cell data key
function findReferenceCellInfo(cellDataKey: string, bloodCellsReference: any) {
  return bloodCellsReference?.cells?.find((refCell: any) =>
    refCell.short_name === cellDataKey
  )
}

// Helper function to generate a single random question with biological relationships
function generateRandomQuestion(cellData: any, bloodCellsReference: any): Question {
  if (!cellData || !bloodCellsReference) {
    throw new Error('Cell data not loaded')
  }

  const allCells = Object.keys(cellData)
  const correctCellType = allCells[Math.floor(Math.random() * allCells.length)]
  const cellInfo = cellData[correctCellType as keyof typeof cellData]
  const referenceInfo = findReferenceCellInfo(correctCellType, bloodCellsReference)

  // Pick a random image for this cell type
  const randomImage = cellInfo.images[Math.floor(Math.random() * cellInfo.images.length)]

  // Use reference name if available, otherwise fall back to cell data name
  const correctAnswerName = referenceInfo ? referenceInfo.name : cellInfo.name

  // Generate challenging options using look-alikes data
  const lookAlikeOptions = generateLookAlikeOptions(correctCellType, cellData)

  // Map cell types to display names, preferring reference names when available
  const options = lookAlikeOptions.map(cellType => {
    const cellInfo = cellData[cellType as keyof typeof cellData]
    if (!cellInfo) return null

    const referenceInfo = findReferenceCellInfo(cellType, bloodCellsReference)
    return referenceInfo ? referenceInfo.name : cellInfo.name
  }).filter(Boolean) as string[]

  // Ensure we have exactly 4 options, fallback to biological options if needed
  if (options.length < 4) {
    const biologicalOptions = generateBiologicalOptions(correctCellType)
    const fallbackOptions = biologicalOptions
      .filter(cellType => !lookAlikeOptions.includes(cellType))
      .slice(0, 4 - options.length)
      .map(cell => {
        const cellInfo = cellData[cell as keyof typeof cellData]
        if (!cellInfo) return null
        const referenceInfo = findReferenceCellInfo(cell, bloodCellsReference)
        return referenceInfo ? referenceInfo.name : cellInfo.name
      })
      .filter(Boolean) as string[]

    options.push(...fallbackOptions)
  }

  // Shuffle the final options
  const shuffledOptions = options.sort(() => Math.random() - 0.5)

  return {
    cellType: correctCellType,
    imagePath: randomImage,
    options: shuffledOptions,
    correctAnswer: correctAnswerName,
    explanation: referenceInfo ?
      `${referenceInfo.key_features || cellInfo.description}` :
      cellInfo.description
  }
}

export default function CellQuizPage() {
  // Fetch cell quiz data from optimized API endpoints
  const { data: cellData, isLoading: cellDataLoading, error: cellDataError } = useCachedData(
    'cell-quiz-images',
    async () => {
      const response = await fetch('/api/tools/cell-quiz/images')
      if (!response.ok) throw new Error('Failed to fetch cell quiz images')
      return response.json()
    },
    {
      ttl: 30 * 60 * 1000, // 30 minutes cache
      staleTime: 15 * 60 * 1000, // 15 minutes stale time
      storage: 'localStorage',
      prefix: 'pathology-bites-cell-quiz'
    }
  )

  const { data: bloodCellsReference, isLoading: referencesLoading, error: referencesError } = useCachedData(
    'cell-quiz-references',
    async () => {
      const response = await fetch('/api/tools/cell-quiz/references')
      if (!response.ok) throw new Error('Failed to fetch cell quiz references')
      return response.json()
    },
    {
      ttl: 30 * 60 * 1000, // 30 minutes cache
      staleTime: 15 * 60 * 1000, // 15 minutes stale time
      storage: 'localStorage',
      prefix: 'pathology-bites-cell-quiz'
    }
  )

  const [mode, setMode] = useState<'menu' | 'quiz' | 'tutorial'>('menu')
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Show loading state while data is being fetched
  const isLoading = cellDataLoading || referencesLoading
  const hasError = cellDataError || referencesError

  const startGame = () => {
    if (!cellData || !bloodCellsReference) return
    setMode('quiz')
    setCurrentQuestion(generateRandomQuestion(cellData, bloodCellsReference))
    setSelectedAnswer(null)
    setShowExplanation(false)
    setScore(0)
    setTotalQuestions(0)
  }

  const startTutorial = () => {
    setMode('tutorial')
  }

  const backToMenu = () => {
    setMode('menu')
  }

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return // Already answered

    const correct = answer === currentQuestion?.correctAnswer
    setSelectedAnswer(answer)
    setShowExplanation(true)
    setIsCorrect(correct)
    setTotalQuestions(prev => prev + 1)

    if (correct) {
      setScore(prev => prev + 1)
    }
  }

  const nextQuestion = () => {
    if (!cellData || !bloodCellsReference) return
    setCurrentQuestion(generateRandomQuestion(cellData, bloodCellsReference))
    setSelectedAnswer(null)
    setShowExplanation(false)
    setIsCorrect(null)

    // Scroll to top of the quiz component with padding above
    if (containerRef.current) {
      const elementTop = containerRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementTop - 100; // 100px above the element
      
      window.scrollTo({
        top: Math.max(0, offsetPosition), // Don't scroll past top of page
        behavior: 'smooth'
      });
    }
  }

  const resetGame = () => {
    setMode('menu')
    setCurrentQuestion(null)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setIsCorrect(null)
    setScore(0)
    setTotalQuestions(0)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero
          title="Cell Identification Quiz"
          description="Test your hematology skills with our interactive cell identification quiz."
        />
        <section className="relative py-8">
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
                <p className="text-sm text-muted-foreground">Loading cell quiz data...</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    )
  }

  // Show error state
  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero
          title="Cell Identification Quiz"
          description="Test your hematology skills with our interactive cell identification quiz."
        />
        <section className="relative py-8">
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4">
                <div className="text-red-600">
                  <X className="h-8 w-8 mx-auto mb-2" />
                  <h3 className="font-semibold">Failed to Load Quiz Data</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {cellDataError?.message || referencesError?.message || 'Unknown error occurred'}
                  </p>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    )
  }

  // Tutorial mode
  if (mode === 'tutorial') {
    return <CellTutorial onBack={backToMenu} bloodCellsReference={bloodCellsReference} cellData={cellData} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Identification Quiz"
        description="Test your hematology skills with our interactive cell identification quiz. Identify different types of blood cells and learn from detailed explanations."
      />

      {/* Quiz Content Section */}
      <section className="relative py-8">
        <div className="flex items-center justify-center p-4">
          {mode === 'menu' ? (
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4 md:space-y-6">
                <h1 className="text-xl md:text-2xl font-bold">Cell Quiz</h1>
                {totalQuestions > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Last: {score}/{totalQuestions} correct
                  </div>
                )}
                <div className="space-y-3">
                  <Button onClick={startGame} size="lg" className="w-full">
                    Start Quiz
                  </Button>
                  <Button onClick={startTutorial} size="lg" variant="outline" className="w-full">
                    Learn Cells
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : mode === 'quiz' && currentQuestion ? (
            <Card ref={containerRef} className="w-full max-w-4xl p-4 md:p-8 shadow-lg">
              <CardContent className="space-y-4 md:space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Score: {score}/{totalQuestions}
                  </div>
                  <Button onClick={resetGame} variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                </div>

                {/* Question */}
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 text-center">What cell type is this?</h2>

                  {/* Responsive Layout: Vertical on mobile, Horizontal on desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {/* Image */}
                    <div className="flex justify-center">
                      <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
                        <Image
                          src={currentQuestion.imagePath}
                          alt="Cell to identify"
                          fill
                          className="object-contain"
                          unoptimized={true}
                        />
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 md:space-y-4">
                      <div className="grid grid-cols-1 gap-2 md:gap-3">
                        {currentQuestion.options.map((option, index) => {
                          const isSelected = selectedAnswer === option
                          const isCorrect = option === currentQuestion.correctAnswer
                          const showResult = showExplanation

                          let buttonClass = ""
                          if (showResult) {
                            if (isCorrect) {
                              buttonClass = "bg-green-100 hover:bg-green-200 text-green-800 border-green-500 dark:bg-green-900/20 dark:text-green-300 dark:border-green-600"
                            } else if (isSelected) {
                              buttonClass = "bg-red-100 hover:bg-red-200 text-red-800 border-red-500 dark:bg-red-900/20 dark:text-red-300 dark:border-red-600"
                            }
                          }

                          return (
                            <Button
                              key={index}
                              variant="outline"
                              className={`w-full justify-start text-left h-auto p-3 md:p-4 text-sm md:text-base ${buttonClass}`}
                              onClick={() => handleAnswerSelect(option)}
                              disabled={!!selectedAnswer}
                            >
                              <div className="flex items-center gap-2 md:gap-3">
                                {showResult && isCorrect && <Check className="h-4 w-4 flex-shrink-0" />}
                                {showResult && isSelected && !isCorrect && <X className="h-4 w-4 flex-shrink-0" />}
                                <span className="break-words">{option}</span>
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  {showExplanation && (
                    <div className="mt-4 md:mt-6 p-3 md:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-left">
                      <h3 className="font-semibold mb-2 text-sm md:text-base">
                        {isCorrect ? 'Correct!' : `Correct Answer: ${currentQuestion.correctAnswer}`}
                      </h3>

                      {/* Get detailed information for the correct answer */}
                      {(() => {
                        // Find the cell data for the correct answer
                        const correctCellEntry = Object.entries(cellData).find(([cellKey, cell]) => {
                          const referenceInfo = findReferenceCellInfo(cellKey, bloodCellsReference)
                          return (referenceInfo ? referenceInfo.name : (cell as any).name) === currentQuestion.correctAnswer
                        })

                        const correctCellKey = correctCellEntry?.[0]
                        const referenceInfo = correctCellKey ? findReferenceCellInfo(correctCellKey, bloodCellsReference) : null

                        if (!referenceInfo) {
                          return <p className="text-xs md:text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                        }

                        return (
                          <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
                            {/* Lineage, Size, and N:C Ratio - responsive layout */}
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
                              <div>
                                <span className="font-semibold text-muted-foreground">Lineage:</span> {referenceInfo.lineage}
                              </div>
                              {referenceInfo.size && (
                                <div>
                                  <span className="font-semibold text-muted-foreground">Size:</span> {referenceInfo.size}
                                </div>
                              )}
                              {referenceInfo.nc_ratio && (
                                <div>
                                  <span className="font-semibold text-muted-foreground">N:C Ratio:</span> {referenceInfo.nc_ratio}
                                </div>
                              )}
                            </div>

                            {/* Percentage */}
                            {referenceInfo.normal_percentage && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Normal Percentage:</span> {referenceInfo.normal_percentage}
                              </div>
                            )}

                            {/* Key Features */}
                            {referenceInfo.key_features && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Key Features:</span> {referenceInfo.key_features}
                              </div>
                            )}

                            {/* Nucleus */}
                            {referenceInfo.nucleus && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Nucleus:</span> {referenceInfo.nucleus}
                              </div>
                            )}

                            {/* Clinical Significance */}
                            {referenceInfo.clinical_significance && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Clinical Significance:</span> {referenceInfo.clinical_significance}
                              </div>
                            )}

                            {/* Notes */}
                            {referenceInfo.notes && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Notes:</span> {referenceInfo.notes}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Next Button - responsive positioning */}
                  {showExplanation && (
                    <div className="mt-4 md:mt-6 flex justify-center md:justify-end">
                      <Button onClick={nextQuestion} size="lg" className="gap-2 w-full sm:w-auto">
                        Next Question
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>Loading...</div>
          )}
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}

// Cell Tutorial Component
function CellTutorial({ onBack, bloodCellsReference, cellData }: {
  onBack: () => void
  bloodCellsReference: any
  cellData: any
}) {
  const [currentCellIndex, setCurrentCellIndex] = useState(0)

  const referenceCells = bloodCellsReference.cells
  const currentReferenceCell = referenceCells[currentCellIndex]

  // Find matching cell data for images using short_name field
  const matchingCellData = Object.entries(cellData).find(([cellKey]) => {
    return cellKey === currentReferenceCell.short_name
  })?.[1]

  const handleNext = () => {
    if (currentCellIndex < referenceCells.length - 1) {
      setCurrentCellIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentCellIndex > 0) {
      setCurrentCellIndex(prev => prev - 1)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Type Tutorial"
        description={`Learn about different blood cell types with detailed descriptions and characteristics. Cell ${currentCellIndex + 1} of ${referenceCells.length}`}
      />

      {/* Tutorial Content */}
      <section className="relative py-8">
        <div className="container px-4 max-w-5xl mx-auto">
          <Card className="p-4 md:p-8 shadow-lg">
            <CardContent className="space-y-4 md:space-y-6">
              {/* Header Navigation */}
              <div className="flex justify-between items-center">
                <div className="text-xs md:text-sm text-muted-foreground">
                  {currentCellIndex + 1} of {referenceCells.length} cells
                </div>
                <Button
                  variant="outline"
                  onClick={onBack}
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </div>

              {/* Cell Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                {/* Image - Smaller area */}
                <div className="flex justify-center">
                  {matchingCellData && (matchingCellData as any).images && (matchingCellData as any).images.length > 0 ? (
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
                      <Image
                        src={(matchingCellData as any).images[0]}
                        alt={currentReferenceCell.name}
                        fill
                        className="object-contain"
                        unoptimized={true}
                      />
                    </div>
                  ) : (
                    <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No image available</span>
                    </div>
                  )}
                </div>

                {/* Information - Larger area (2 columns) */}
                <div className="md:col-span-2 space-y-3 md:space-y-4">
                  <h2 className="text-2xl md:text-3xl font-bold">{currentReferenceCell.name}</h2>

                  <div className="space-y-2 md:space-y-3">
                    {/* Size, N:C Ratio, Normal Range - responsive layout */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs md:text-sm">
                      {currentReferenceCell.size && (
                        <div>
                          <span className="font-semibold text-muted-foreground">Size:</span> {currentReferenceCell.size}
                        </div>
                      )}
                      {currentReferenceCell.nc_ratio && (
                        <div>
                          <span className="font-semibold text-muted-foreground">N:C Ratio:</span> {currentReferenceCell.nc_ratio}
                        </div>
                      )}
                      {currentReferenceCell.normal_percentage && (
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">Normal Range:</span> {currentReferenceCell.normal_percentage}
                        </div>
                      )}
                    </div>

                    {/* Key Features */}
                    {currentReferenceCell.key_features && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Key Features
                        </h3>
                        <p className="text-sm">{currentReferenceCell.key_features}</p>
                      </div>
                    )}

                    {/* Nucleus */}
                    {currentReferenceCell.nucleus && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Nucleus
                        </h3>
                        <p className="text-sm">{currentReferenceCell.nucleus}</p>
                      </div>
                    )}

                    {/* Normal Percentage */}
                    {currentReferenceCell.normal_percentage && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Normal Percentage
                        </h3>
                        <p className="text-sm">{currentReferenceCell.normal_percentage}</p>
                      </div>
                    )}

                    {/* Clinical Significance */}
                    {currentReferenceCell.clinical_significance && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Clinical Significance
                        </h3>
                        <p className="text-sm">{currentReferenceCell.clinical_significance}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {currentReferenceCell.notes && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Notes
                        </h3>
                        <p className="text-sm">{currentReferenceCell.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Bottom Navigation */}
              <div className="flex justify-between items-center pt-4 border-t gap-2">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentCellIndex === 0}
                  className="flex-1 sm:flex-none"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={currentCellIndex === referenceCells.length - 1}
                  className="flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* References Section */}
          <div className="mt-6 md:mt-8 pt-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">References</h3>
            <div className="text-xs md:text-sm text-gray-600 leading-relaxed flex items-start space-x-2">
              <a
                href="https://doi.org/10.1007/s00277-020-04255-4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors mt-0.5 flex-shrink-0"
              >
                <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
              </a>
              <span className="break-words">
                Parmentier S, Kramer M, Weller S, Schuler U, Ordemann R, Rall G, et al. (2020).
                Reevaluation of reference values for bone marrow differential counts in 236 healthy bone marrow donors.
                <em> Ann Hematol</em>, 99(12), 2723-2729.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}