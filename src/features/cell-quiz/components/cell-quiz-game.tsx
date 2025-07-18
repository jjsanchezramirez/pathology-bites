'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { Check, X, RotateCcw, Target, Zap, ChevronRight, Trophy, BookOpen } from 'lucide-react'
import Image from 'next/image'
import cellData from '@/data/cell-data.json'

type QuizSet = 'myeloid' | 'erythroid' | 'other_cells' | 'all_cells'

interface CellQuizGameProps {
  quizSet: QuizSet
  onComplete: (results: { correct: number; total: number; streak: number }) => void
  onExit: () => void
  stats?: { correct: number; total: number; streak: number; bestStreak: number }
  onTutorial?: () => void
}

interface Question {
  cellType: string
  imagePath: string
  options: string[]
  correctAnswer: string
  explanation: string
}

const QUESTIONS_PER_QUIZ = 10

export function CellQuizGame({ quizSet, onComplete, onExit, stats: externalStats, onTutorial }: CellQuizGameProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [isAnswered, setIsAnswered] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)

  const generateQuestions = useCallback(() => {
    const availableCells = Object.entries(cellData).filter(([_, cell]) => {
      if (!cell.categories) return false
      return cell.categories.includes(quizSet)
    })

    if (availableCells.length === 0) return []

    const questions: Question[] = []
    
    for (let i = 0; i < QUESTIONS_PER_QUIZ; i++) {
      const [correctCellType, correctCell] = availableCells[Math.floor(Math.random() * availableCells.length)]
      const randomImage = correctCell.images[Math.floor(Math.random() * correctCell.images.length)]
      
      // Get unique wrong options, excluding the correct answer
      const wrongOptions = availableCells
        .filter(([cellType]) => cellType !== correctCellType)
        .map(([cellType, cell]) => cell.name)
        .filter((name, index, array) => array.indexOf(name) === index) // Remove duplicates
        .filter(name => name !== correctCell.name) // Ensure correct answer isn't included
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)

      const options = [correctCell.name, ...wrongOptions].sort(() => Math.random() - 0.5)
      
      questions.push({
        cellType: correctCellType,
        imagePath: randomImage,
        options,
        correctAnswer: correctCell.name,
        explanation: correctCell.description
      })
    }

    return questions
  }, [quizSet])

  useEffect(() => {
    const newQuestions = generateQuestions()
    if (newQuestions.length > 0) {
      setQuestions(newQuestions)
    } else {
      // Fallback questions if generation fails
      const fallbackQuestions: Question[] = [
        {
          cellType: 'band',
          imagePath: '/images/cells/band_000.png',
          options: ['Band', 'Blast', 'Lymphocyte', 'Monocyte'],
          correctAnswer: 'Band',
          explanation: 'A band is an immature neutrophil with a horseshoe-shaped nucleus.'
        },
        {
          cellType: 'blast',
          imagePath: '/images/cells/blast_000.png',
          options: ['Blast', 'Band', 'Lymphocyte', 'Plasma Cell'],
          correctAnswer: 'Blast',
          explanation: 'A blast is an immature cell with a large nucleus and prominent nucleoli.'
        }
      ]
      setQuestions(fallbackQuestions)
    }
  }, [generateQuestions])

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / QUESTIONS_PER_QUIZ) * 100

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return

    setSelectedAnswer(answer)
    setIsAnswered(true)

    const isCorrect = answer === currentQuestion.correctAnswer

    if (isCorrect) {
      setScore(prev => prev + 1)
      setStreak(prev => {
        const newStreak = prev + 1
        setMaxStreak(current => Math.max(current, newStreak))
        return newStreak
      })
    } else {
      setStreak(0)
    }

    setShowExplanation(true)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setSelectedAnswer(null)
      setShowExplanation(false)
      setIsAnswered(false)
    } else {
      setQuizComplete(true)
      onComplete({
        correct: score + (selectedAnswer === currentQuestion.correctAnswer ? 1 : 0),
        total: QUESTIONS_PER_QUIZ,
        streak: maxStreak
      })
    }
  }

  const restartQuiz = () => {
    const newQuestions = generateQuestions()
    setQuestions(newQuestions)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setIsAnswered(false)
    setQuizComplete(false)
  }

  console.log('Render check - currentQuestion:', !!currentQuestion, 'questions.length:', questions.length)

  if (!currentQuestion || questions.length === 0) {
    return (
      <Card className="shadow-lg max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <p>Loading questions... (Questions: {questions.length})</p>
        </CardContent>
      </Card>
    )
  }

  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer
  const finalScore = score + (isAnswered && isCorrect ? 1 : 0)

  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardContent className="p-0">
        {quizComplete ? (
          <div className="p-12 text-center space-y-8">
            <div className="space-y-2">
              <div className="text-4xl font-bold">
                {finalScore}/{QUESTIONS_PER_QUIZ}
              </div>
              <div className="text-muted-foreground">
                {Math.round((finalScore / QUESTIONS_PER_QUIZ) * 100)}% correct
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={restartQuiz} size="lg">
                Try Again
              </Button>
              <Button onClick={onExit} variant="outline" size="lg">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  {score}/{currentQuestionIndex + (isAnswered ? 1 : 0)} correct
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentQuestionIndex + 1} of {QUESTIONS_PER_QUIZ}
                </div>
              </div>
              <Progress value={progress} className="h-1" />
            </div>

            <div className="grid md:grid-cols-5 gap-0">
              <div className="md:col-span-3 relative h-96 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="relative w-full h-full max-w-[400px] max-h-[400px] aspect-square">
                  <Image
                    src={currentQuestion.imagePath}
                    alt="Cell to identify"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="md:col-span-2 p-6 flex flex-col justify-center">
                <div className="space-y-4">

                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === option
                      const isCorrectOption = option === currentQuestion.correctAnswer
                      const showCorrect = isAnswered && isCorrectOption
                      const showIncorrect = isAnswered && isSelected && !isCorrectOption

                      return (
                        <button
                          key={option}
                          onClick={() => {
                            console.log('Button clicked:', option)
                            handleAnswerSelect(option)
                          }}
                          disabled={isAnswered}
                          className={`
                            w-full p-3 rounded-lg text-left border-2 transition-all text-sm
                            ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                            ${isSelected && !isAnswered ? 'border-primary bg-primary/10' : 'border-border'}
                            ${showCorrect ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40' : ''}
                            ${showIncorrect ? 'border-orange-600 bg-orange-100 dark:bg-orange-900/40' : ''}
                            ${isAnswered ? 'cursor-default' : 'cursor-pointer'}
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`
                                flex items-center justify-center w-5 h-5 rounded-full border text-xs font-medium
                                ${isSelected && !isAnswered ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'}
                                ${showCorrect ? 'border-emerald-600 bg-emerald-600 text-white' : ''}
                                ${showIncorrect ? 'border-orange-600 bg-orange-600 text-white' : ''}
                              `}>
                                {String.fromCharCode(65 + index)}
                              </span>
                              <span className="font-medium">{option}</span>
                            </div>
                            {showCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                            {showIncorrect && <X className="w-4 h-4 text-orange-600" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {showExplanation && (
                    <div className={`
                      p-3 rounded-lg border-l-4 transition-all duration-500
                      ${isCorrect ? 'border-l-emerald-600 bg-emerald-100 dark:bg-emerald-900/40' : 'border-l-orange-600 bg-orange-100 dark:bg-orange-900/40'}
                    `}>
                      <div className="flex items-start gap-2">
                        <div className={`
                          flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                          ${isCorrect ? 'bg-emerald-600' : 'bg-orange-600'}
                        `}>
                          {isCorrect ? <Check className="w-3 h-3 text-white" /> : <X className="w-3 h-3 text-white" />}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${currentQuestion.correctAnswer}.`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showExplanation && (
              <div className="p-6 border-t">
                <Button onClick={handleNextQuestion} className="w-full gap-2">
                  {currentQuestionIndex < questions.length - 1 ? (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    'Complete Quiz'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
