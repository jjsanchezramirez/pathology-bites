'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MultiStepQuestionForm } from './components/multi-step-question-form'
import { QuestionFormData } from '@/features/questions/types/questions'

export function CreateQuestionClient() {
  const router = useRouter()

  // Handle form submission
  const handleSubmit = async (data: QuestionFormData) => {
    try {
      const response = await fetch('/api/admin/questions-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create question')
      }

      toast.success('Question created successfully!')
      router.push('/admin/questions')
      router.refresh()
    } catch (error) {
      console.error('Error creating question:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create question')
      throw error // Re-throw to let the form handle it
    }
  }

  const handleCancel = () => {
    router.push('/admin/questions')
  }

  return (
    <div className="space-y-6">
      <MultiStepQuestionForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}
