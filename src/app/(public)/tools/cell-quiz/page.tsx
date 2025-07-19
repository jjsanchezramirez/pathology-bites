'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Check, X, RotateCcw, ArrowLeft, ArrowRight, ChevronRight, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import FloatingCharacter from '@/shared/components/common/dr-albright'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import cellData from '@/data/cell-data.json'
import bloodCellsReference from '@/data/blood_cells_reference.json'
import { generateLookAlikeOptions, generateBiologicalOptions } from '@/features/cell-quiz/data/cell-pathways'

interface Question {
  cellType: string
  imagePath: string
  options: string[]
  correctAnswer: string
  explanation: string
}

// Helper function to find reference cell info by cell data name
function findReferenceCellInfo(cellDataName: string) {
  return bloodCellsReference.cells.find(refCell => {
    const refName = refCell.name.toLowerCase()
    const cellName = cellDataName.toLowerCase()

    // Direct name matches
    if (cellName === refName) return true

    // Special cases for naming mismatches
    if ((cellName === 'segmented' || cellName === 'band') && refName === 'neutrophil (segmented or band)') return true
    if (cellName === 'blast' && refName === 'myeloblast') return true
    if (cellName === 'proerythroblast' && refName === 'erythroid precursor, pronormoblast') return true
    if (cellName === 'basophilic' && refName === 'erythroid precursor, basophilic normoblast') return true
    if (cellName === 'polychromatic' && refName === 'erythroid precursor, polychromatophilic normoblast') return true
    if (cellName === 'orthochromatic' && refName === 'erythroid precursor, orthochromic normoblast') return true
    if (cellName === 'promonocyte' && refName === 'monocyte, immature (promonocyte)') return true
    if (cellName === 'macrophage' && refName === 'foamy macrophage') return true
    if (cellName === 'plasma' && refName === 'plasma cell') return true

    return false
  })
}

// Helper function to generate a single random question with biological relationships
function generateRandomQuestion(): Question {
  const allCells = Object.keys(cellData)
  const correctCellType = allCells[Math.floor(Math.random() * allCells.length)]
  const cellInfo = cellData[correctCellType as keyof typeof cellData]
  const referenceInfo = findReferenceCellInfo(cellInfo.name)

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

    const referenceInfo = findReferenceCellInfo(cellInfo.name)
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
        const referenceInfo = findReferenceCellInfo(cellInfo.name)
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
  const [mode, setMode] = useState<'menu' | 'quiz' | 'tutorial'>('menu')

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const startGame = () => {
    setMode('quiz')
    setCurrentQuestion(generateRandomQuestion())
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
    setCurrentQuestion(generateRandomQuestion())
    setSelectedAnswer(null)
    setShowExplanation(false)
    setIsCorrect(null)
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

  // Tutorial mode
  if (mode === 'tutorial') {
    return <CellTutorial onBack={backToMenu} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Cell Identification Quiz
              </h1>
              <p className="text-lg text-muted-foreground">
                Test your hematology skills with our interactive cell identification quiz.
                Identify different types of blood cells and learn from detailed explanations.
              </p>




            </div>

            {/* Character - hidden on mobile */}
            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quiz Content Section */}
      <section className="relative py-8">
        <div className="flex items-center justify-center p-4">
          {mode === 'menu' ? (
            <Card className="w-full max-w-sm p-8 text-center shadow-lg">
              <CardContent className="space-y-6">
                <h1 className="text-2xl font-bold">Cell Quiz</h1>
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
            <Card className="w-full max-w-4xl p-8 shadow-lg">
              <CardContent className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Score: {score}/{totalQuestions}
                  </div>
                  <Button onClick={resetGame} variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Question */}
                <div>
                  <h2 className="text-xl font-semibold mb-6 text-center">What cell type is this?</h2>

                  {/* Horizontal Layout: Image Left, Options Right */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Image */}
                    <div className="flex justify-center">
                      <div className="relative w-64 h-64 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
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
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        {currentQuestion.options.map((option, index) => {
                          const isSelected = selectedAnswer === option
                          const isCorrect = option === currentQuestion.correctAnswer
                          const showResult = showExplanation

                          let buttonClass = ""
                          if (showResult) {
                            if (isCorrect) {
                              buttonClass = "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                            } else if (isSelected) {
                              buttonClass = "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            }
                          }

                          return (
                            <Button
                              key={index}
                              variant="outline"
                              className={`w-full justify-start text-left h-auto p-4 ${buttonClass}`}
                              onClick={() => handleAnswerSelect(option)}
                              disabled={!!selectedAnswer}
                            >
                              <div className="flex items-center gap-3">
                                {showResult && isCorrect && <Check className="h-4 w-4" />}
                                {showResult && isSelected && !isCorrect && <X className="h-4 w-4" />}
                                <span>{option}</span>
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  {showExplanation && (
                    <div className="mt-6 p-4 bg-muted rounded-lg text-left">
                      <h3 className="font-semibold mb-2">
                        {isCorrect ? 'Correct!' : `Correct Answer: ${currentQuestion.correctAnswer}`}
                      </h3>

                      {/* Get detailed information for the correct answer */}
                      {(() => {
                        // Find the cell data for the correct answer
                        const correctCellData = Object.entries(cellData).find(([, cell]) => {
                          const referenceInfo = findReferenceCellInfo(cell.name)
                          return (referenceInfo ? referenceInfo.name : cell.name) === currentQuestion.correctAnswer
                        })?.[1]

                        const referenceInfo = correctCellData ? findReferenceCellInfo(correctCellData.name) : null

                        if (!referenceInfo) {
                          return <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                        }

                        return (
                          <div className="space-y-3 text-sm">
                            {/* Lineage, Size, and N:C Ratio in one line */}
                            <div className="flex flex-wrap gap-4">
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

                  {/* Next Button - moved below explanation, aligned right */}
                  {showExplanation && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={nextQuestion} size="lg" className="gap-2">
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

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}

// Cell Tutorial Component
function CellTutorial({ onBack }: { onBack: () => void }) {
  const [currentCellIndex, setCurrentCellIndex] = useState(0)

  const referenceCells = bloodCellsReference.cells
  const currentReferenceCell = referenceCells[currentCellIndex]

  // Find matching cell data for images with improved matching logic
  const matchingCellData = Object.entries(cellData).find(([, cell]) => {
    const refName = currentReferenceCell.name.toLowerCase()
    const cellName = cell.name.toLowerCase()

    // Direct name matches
    if (cellName === refName) return true

    // Special cases for naming mismatches
    if (refName === 'neutrophil (segmented or band)' && (cellName === 'segmented' || cellName === 'band')) return true
    if (refName === 'myeloblast' && cellName === 'blast') return true
    if (refName === 'erythroid precursor, pronormoblast' && cellName === 'proerythroblast') return true
    if (refName === 'erythroid precursor, basophilic normoblast' && cellName === 'basophilic') return true
    if (refName === 'erythroid precursor, polychromatophilic normoblast' && cellName === 'polychromatic') return true
    if (refName === 'erythroid precursor, orthochromic normoblast' && cellName === 'orthochromatic') return true
    if (refName === 'monocyte, immature (promonocyte)' && cellName === 'promonocyte') return true
    if (refName === 'foamy macrophage' && cellName === 'macrophage') return true
    if (refName === 'plasma cell' && cellName === 'plasma') return true

    return false
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
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />

        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Cell Type Tutorial
              </h1>
              <p className="text-lg text-muted-foreground">
                Learn about different blood cell types with detailed descriptions and characteristics.
                Cell {currentCellIndex + 1} of {referenceCells.length}
              </p>
            </div>

            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial Content */}
      <section className="relative py-8">
        <div className="container px-4 max-w-4xl mx-auto">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Header Navigation */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {currentCellIndex + 1} of {referenceCells.length} cells
                </div>
                <Button
                  variant="outline"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>

              {/* Cell Information */}
              <div className="grid md:grid-cols-3 gap-8">
                {/* Image - Smaller area */}
                <div className="flex justify-center">
                  {matchingCellData ? (
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
                      <Image
                        src={matchingCellData.images[0]}
                        alt={currentReferenceCell.name}
                        fill
                        className="object-contain"
                        unoptimized={true}
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 rounded-lg border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-muted-foreground">No image available</span>
                    </div>
                  )}
                </div>

                {/* Information - Larger area (2 columns) */}
                <div className="md:col-span-2 space-y-4">
                  <h2 className="text-3xl font-bold">{currentReferenceCell.name}</h2>

                  <div className="space-y-3">
                    {/* Lineage, Size, and N:C Ratio in one line */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-muted-foreground">Lineage:</span> {currentReferenceCell.lineage}
                      </div>
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
                    </div>

                    {/* Percentage */}
                    {currentReferenceCell.normal_percentage && (
                      <div className="text-sm">
                        <span className="font-semibold text-muted-foreground">Normal Percentage:</span> {currentReferenceCell.normal_percentage}
                      </div>
                    )}

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
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentCellIndex === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={currentCellIndex === referenceCells.length - 1}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* References Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">References</h3>
                <div className="text-sm text-gray-600 leading-relaxed flex items-start space-x-2">
                  <a
                    href="https://doi.org/10.1007/s00277-020-04255-4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors mt-0.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <span>
                    Parmentier S, Kramer M, Weller S, Schuler U, Ordemann R, Rall G, et al. (2020).
                    Reevaluation of reference values for bone marrow differential counts in 236 healthy bone marrow donors.
                    <em> Ann Hematol</em>, 99(12), 2723-2729.
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
