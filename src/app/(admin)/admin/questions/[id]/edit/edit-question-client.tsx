'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { QuestionFormData, QuestionWithDetails } from '@/features/questions/types/questions'
import { MultiStepQuestionForm } from '@/app/(admin)/admin/create-question/components/multi-step-question-form'

interface EditQuestionClientProps {
  questionId: string
}

export function EditQuestionClient({ questionId }: EditQuestionClientProps) {
  const router = useRouter()
  const [question, setQuestion] = useState<QuestionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch question data
  useEffect(() => {
    async function fetchQuestion() {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/questions/${questionId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch question')
        }

        const data = await response.json()
        setQuestion(data.question)
      } catch (err) {
        console.error('Error fetching question:', err)
        setError(err instanceof Error ? err.message : 'Failed to load question')
        toast.error('Failed to load question')
      } finally {
        setLoading(false)
      }
    }

    fetchQuestion()
  }, [questionId])

  // Handle form submission
  const handleSubmit = async (data: QuestionFormData) => {
    try {
      const response = await fetch(`/api/admin/questions/${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          questionData: {
            title: data.title,
            stem: data.stem,
            difficulty: data.difficulty,
            teaching_point: data.teaching_point,
            question_references: data.question_references,
            status: data.status,
            question_set_id: data.question_set_id,
          },
          answerOptions: data.answerOptions,
          questionImages: data.questionImages,
          tagIds: data.tag_ids,
          categoryId: data.category_id,
          changeSummary: 'Question updated via edit page',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update question')
      }

      toast.success('Question updated successfully!')
      router.push('/admin/questions')
      router.refresh()
    } catch (error) {
      console.error('Error updating question:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update question')
      throw error // Re-throw to let the form handle it
    }
  }

  const handleCancel = () => {
    router.push('/admin/questions')
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error || !question) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || 'Question not found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MultiStepQuestionForm
        mode="edit"
        initialData={question}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}

