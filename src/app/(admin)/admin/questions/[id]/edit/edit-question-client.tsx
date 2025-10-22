'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, AlertCircle, Send, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from "@/shared/components/ui/alert"
import { Button } from "@/shared/components/ui/button"
import { Card } from "@/shared/components/ui/card"
import { Form } from "@/shared/components/ui/form"

import { QuestionWithDetails } from '@/features/questions/types/questions'
import { useEditQuestionForm } from '@/features/questions/hooks/use-edit-question-form'

// Import tab components
import { TabNavigation } from './tab-navigation'
import { ContentTab } from './content-tab'
import { ImagesTab } from '@/features/questions/components/edit-question-dialog/images-tab'
import { MetadataTab } from './metadata-tab'

interface EditQuestionClientProps {
  questionId: string
}

export function EditQuestionClient({ questionId }: EditQuestionClientProps) {
  const router = useRouter()
  const [question, setQuestion] = useState<QuestionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('content')
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)

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

  // Use the edit question form hook
  const {
    form,
    isSubmitting,
    hasUnsavedChanges,
    selectedTagIds,
    answerOptions,
    questionImages,
    isPatchEdit,
    patchEditReason,
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    setIsPatchEdit,
    setPatchEditReason,
    handleSubmit,
    handleUnsavedChanges,
  } = useEditQuestionForm({
    question: question || undefined,
    open: !!question,
    onSave: () => {
      toast.success('Question updated successfully!')
      router.push('/admin/my-questions')
      router.refresh()
    },
    onClose: () => {
      router.push('/admin/my-questions')
    },
  })

  // Handle cancel
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/admin/my-questions')
      }
    } else {
      router.push('/admin/my-questions')
    }
  }

  // Handle save and submit for review
  const handleSaveAndSubmit = async () => {
    try {
      // Set status to pending_review
      form.setValue('status', 'pending_review')

      // Submit the form (the onSave callback will handle toast and navigation)
      await form.handleSubmit(handleSubmit)()
    } catch (error) {
      console.error('Save and submit error:', error)
      toast.error('Failed to save and submit question')
    }
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
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Question not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/admin/my-questions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Questions
        </Button>
      </div>
    )
  }

  // Get reviewer feedback if question was flagged or needs revision
  const reviewerFeedback = question.status === 'flagged' || question.status === 'needs_revision'
    ? question.reviews?.[0]?.feedback
    : null

  return (
    <div className="space-y-6">
      {/* Reviewer Feedback Alert */}
      {reviewerFeedback && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Reviewer Feedback:</p>
              <p className="text-sm">{reviewerFeedback}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Question Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <span className={`text-sm font-medium px-2 py-1 rounded ${
          question.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
          question.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
          question.status === 'flagged' || question.status === 'needs_revision' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
        }`}>
          {question.status === 'needs_revision' ? 'Needs Revision' :
           question.status === 'pending_review' ? 'Pending Review' :
           question.status === 'published' ? 'Published' :
           question.status === 'flagged' ? 'Flagged' :
           'Draft'}
        </span>
        {question.version && (
          <>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">Version: {question.version}</span>
          </>
        )}
      </div>

      {/* Main Form */}
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(handleSubmit)(e);
          }}
          className="space-y-6"
        >
          <Card className="overflow-hidden">
            {/* Tab Navigation */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'content' && (
                <ContentTab
                  form={form}
                  question={question}
                  onUnsavedChanges={handleUnsavedChanges}
                  answerOptions={answerOptions}
                  onAnswerOptionsChange={setAnswerOptions}
                />
              )}
              {activeTab === 'images' && (
                <ImagesTab
                  question={question}
                  onUnsavedChanges={handleUnsavedChanges}
                  questionImages={questionImages}
                  onQuestionImagesChange={setQuestionImages}
                />
              )}
              {activeTab === 'metadata' && (
                <MetadataTab
                  form={form}
                  question={question}
                  onUnsavedChanges={handleUnsavedChanges}
                  selectedTagIds={selectedTagIds}
                  onTagsChange={setSelectedTagIds}
                />
              )}
            </div>
          </Card>

          {/* Edit Type Selection for Published Questions */}
          {question.status === 'published' && (
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Edit Type</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Select the type of edit you're making to this published question.
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Patch Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(true);
                      form.setValue('updateType', 'patch');
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-patch"
                      name="editType"
                      checked={isPatchEdit}
                      onChange={() => {
                        setIsPatchEdit(true);
                        form.setValue('updateType', 'patch');
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor="editType-patch" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                        Patch Edit (No Review Needed)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Typos, formatting, metadata only. Version: 1.0.x
                      </p>
                    </div>
                  </div>

                  {/* Minor Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(false);
                      form.setValue('updateType', 'minor');
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-minor"
                      name="editType"
                      checked={!isPatchEdit && form.getValues('updateType') === 'minor'}
                      onChange={() => {
                        setIsPatchEdit(false);
                        form.setValue('updateType', 'minor');
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor="editType-minor" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                        Minor Edit (Requires Review)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Content changes (stem, options, explanations, teaching point). Version: 1.x.0
                      </p>
                    </div>
                  </div>

                  {/* Major Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(false);
                      form.setValue('updateType', 'major');
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-major"
                      name="editType"
                      checked={!isPatchEdit && form.getValues('updateType') === 'major'}
                      onChange={() => {
                        setIsPatchEdit(false);
                        form.setValue('updateType', 'major');
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor="editType-major" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                        Major Edit (Requires Review)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Question overhaul or answer change. Version: x.0.0
                      </p>
                    </div>
                  </div>
                </div>

                {isPatchEdit && (
                  <div>
                    <label htmlFor="patchEditReason" className="text-xs font-medium text-blue-900 dark:text-blue-100">
                      Reason for patch edit (optional)
                    </label>
                    <textarea
                      id="patchEditReason"
                      value={patchEditReason}
                      onChange={(e) => {
                        setPatchEditReason(e.target.value);
                        handleUnsavedChanges();
                      }}
                      placeholder="e.g., Fixed typo in question stem"
                      className="mt-1 w-full text-xs p-2 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-blue-950/50 text-foreground"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <div className="flex gap-3">
              <Button
                type="submit"
                variant="outline"
                disabled={isSubmitting || !hasUnsavedChanges}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  hasUnsavedChanges ? 'Save Changes' : 'No Changes'
                )}
              </Button>

              {question.status !== 'published' && question.status !== 'pending_review' && (
                <Button
                  type="button"
                  onClick={handleSaveAndSubmit}
                  disabled={isSubmitting || !hasUnsavedChanges}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving & Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Save & Submit for Review
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
