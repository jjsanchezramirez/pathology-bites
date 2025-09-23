// src/app/(dashboard)/dashboard/quiz/[id]/review/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Clock,
  Target
} from "lucide-react"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"

export default function QuizReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(true)

  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id

  // Fetch quiz results on component mount
  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Fetch from API
        const response = await fetch(`/api/quiz/sessions/${params?.id}/results`)
        if (!response.ok) {
          throw new Error('Failed to fetch quiz results')
        }
        const data = await response.json()
        setResult(data.data)
      } catch (error) {
        toast.error('Failed to load quiz results')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }

    if (params?.id) {
      fetchResults()
    }
  }, [params?.id, sessionId])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Questions Skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600">Quiz Results Not Available</h1>
          <p className="text-muted-foreground mt-2">
            The quiz results you're looking for don't exist or couldn't be loaded.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Results
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Quiz Review</h1>
          <p className="text-muted-foreground text-sm">
            Review all questions and answers from your quiz
          </p>
        </div>
      </div>

      {/* Questions Review */}
      <div className="space-y-6">
        {result.questionDetails?.map((question, index) => (
          <Card key={question.id} id={`question-${index + 1}`} className="scroll-mt-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-3">
                  {question.isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Question {index + 1}: {question.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {question.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.difficulty}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Time spent: {formatTime(question.timeSpent)}
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {question.totalAttempts && question.totalAttempts >= 30
                    ? `${question.successRate}% success rate`
                    : 'Insufficient data'
                  }
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Question Content */}
              <div className="space-y-4">
                {/* Question Text */}
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: question.questionText || '' }} />
                </div>

                {/* Question Images */}
                {question.images && question.images.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {question.images.map((image, imgIndex) => (
                      <div key={imgIndex} className="relative">
                        <Image
                          src={image.url}
                          alt={image.alt || `Question image ${imgIndex + 1}`}
                          width={300}
                          height={200}
                          className="rounded-lg object-cover w-full h-48"
                          unoptimized={true}
                        />
                        {image.caption && (
                          <p className="text-xs text-muted-foreground mt-1">{image.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer Options */}
                <div className="space-y-2">
                  <h4 className="font-medium">Answer Options:</h4>
                  <div className="space-y-2">
                    {question.options?.map((option, optionIndex) => {
                      const isCorrect = option.isCorrect
                      const isUserSelected = question.userSelectedOptionId === option.id
                      
                      let optionClass = "p-3 border rounded-lg "
                      if (isCorrect) {
                        optionClass += "border-green-500 bg-green-50 dark:bg-green-950/20"
                      } else if (isUserSelected && !isCorrect) {
                        optionClass += "border-red-500 bg-red-50 dark:bg-red-950/20"
                      } else {
                        optionClass += "border-gray-200 bg-gray-50 dark:bg-gray-950/20"
                      }

                      return (
                        <div key={option.id} className={optionClass}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-sm">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              <div dangerouslySetInnerHTML={{ __html: option.text }} />
                            </div>
                            <div className="flex items-center gap-2">
                              {isCorrect && (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                  Correct Answer
                                </Badge>
                              )}
                              {isUserSelected && !isCorrect && (
                                <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300">
                                  Your Answer
                                </Badge>
                              )}
                              {isUserSelected && isCorrect && (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                  Your Answer ✓
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Explanation */}
                {question.explanation && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Explanation:</h4>
                    <div className="prose prose-sm max-w-none text-blue-800 dark:text-blue-200">
                      <div dangerouslySetInnerHTML={{ __html: question.explanation }} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Back to Results Button */}
      <div className="flex justify-center pt-6">
        <Link href={`/dashboard/quiz/${sessionId}/results`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
        </Link>
      </div>
    </div>
  )
}
