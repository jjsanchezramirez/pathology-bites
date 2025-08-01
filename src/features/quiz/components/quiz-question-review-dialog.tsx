'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Check, X, Clock, Users, BookOpen } from 'lucide-react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'

interface QuestionDetail {
  id: string
  title: string
  stem: string
  difficulty: string
  category: string
  isCorrect: boolean
  selectedAnswerId: string | null
  timeSpent: number
  successRate: number
}

interface QuestionOption {
  id: string
  text: string
  is_correct: boolean
}

interface QuestionData {
  id: string
  title: string
  stem: string
  teaching_point: string
  difficulty: string
  question_options: QuestionOption[]
}

interface QuizQuestionReviewDialogProps {
  questionDetail: QuestionDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuizQuestionReviewDialog({
  questionDetail,
  open,
  onOpenChange
}: QuizQuestionReviewDialogProps) {
  const [questionData, setQuestionData] = useState<QuestionData | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open && questionDetail) {
      fetchQuestionData()
    }
  }, [open, questionDetail])

  const fetchQuestionData = async () => {
    if (!questionDetail) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          stem,
          teaching_point,
          difficulty,
          question_options(*)
        `)
        .eq('id', questionDetail.id)
        .single()

      if (error) {
        console.error('Error fetching question data:', error)
        toast.error('Failed to load question details')
        return
      }

      setQuestionData(data)
    } catch (error) {
      console.error('Error fetching question data:', error)
      toast.error('Failed to load question details')
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'hard': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  if (!questionDetail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Question Review: {questionDetail.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : questionData ? (
          <div className="space-y-6">
            {/* Question Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={getDifficultyColor(questionDetail.difficulty)}>
                  {questionDetail.difficulty}
                </Badge>
                <Badge variant="outline">
                  {questionDetail.category}
                </Badge>
                <Badge variant={questionDetail.isCorrect ? "default" : "destructive"}>
                  {questionDetail.isCorrect ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Correct
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Incorrect
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime(questionDetail.timeSpent)}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {questionDetail.successRate}% success rate
                </div>
              </div>
            </div>

            <Separator />

            {/* Question Content */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Question</h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap">{questionData.stem}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Answer Options */}
              <div>
                <h3 className="font-medium mb-2">Answer Options</h3>
                <div className="space-y-2">
                  {questionData.question_options.map((option, index) => {
                    const isSelected = option.id === questionDetail.selectedAnswerId
                    const isCorrect = option.is_correct
                    
                    let cardClass = "border"
                    if (isCorrect) {
                      cardClass += " bg-green-50 border-green-200"
                    } else if (isSelected && !isCorrect) {
                      cardClass += " bg-red-50 border-red-200"
                    }

                    return (
                      <Card key={option.id} className={cardClass}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <span className="font-medium">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            <div className="flex-1">
                              <p>{option.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {isCorrect && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Correct Answer
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Badge variant="outline" className="text-xs">
                                    Your Answer
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Teaching Point */}
              <div>
                <h3 className="font-medium mb-2">Explanation</h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap">{questionData.teaching_point}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load question details
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
