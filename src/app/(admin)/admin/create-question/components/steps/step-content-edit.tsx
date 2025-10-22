'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { FormState } from '../multi-step-question-form'
import { getModelById } from '@/shared/config/ai-models'
import { createClient } from '@/shared/services/client'

interface StepContentEditProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
  questionSetAIModel?: string | null // AI model from the question set
}

interface Category {
  id: string
  name: string
}

interface QuestionSet {
  id: string
  name: string
}

interface Tag {
  id: string
  name: string
}

export function StepContentEdit({ formState, updateFormState, questionSetAIModel }: StepContentEditProps) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhancementRequest, setEnhancementRequest] = useState('')
  const [isFetchingReferences, setIsFetchingReferences] = useState(false)

  // Determine which AI model to use for refinement
  // Priority: 1. Question set's AI model, 2. Selected AI model from Step 1, 3. Default fast model
  const refinementModel = questionSetAIModel || formState.selectedAIModel || 'Llama-3.3-8B-Instruct'

  // Get friendly model name for display
  const modelInfo = getModelById(refinementModel)
  const modelDisplayName = modelInfo?.name || refinementModel

  // Handle AI enhancement
  const handleAIEnhancement = async () => {
    if (!formState.title || !formState.stem) {
      toast.error('Please fill in the question title and stem first')
      return
    }

    setIsEnhancing(true)
    try {
      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'enhance_question',
          content: {
            title: formState.title,
            stem: formState.stem,
            answerOptions: formState.answerOptions,
            teaching_point: formState.teaching_point,
            question_references: formState.question_references
          },
          instructions: enhancementRequest || 'Improve the clarity, accuracy, and pedagogical value of this question while maintaining its core concept.',
          model: refinementModel
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to enhance question')
      }

      const data = await response.json()

      // Update form with enhanced content
      if (data.title) updateFormState({ title: data.title })
      if (data.stem) updateFormState({ stem: data.stem })
      if (data.teaching_point) updateFormState({ teaching_point: data.teaching_point })
      if (data.answer_options) {
        const enhancedOptions = data.answer_options.map((option: any, index: number) => ({
          text: option.text || '',
          is_correct: option.is_correct || false,
          explanation: option.explanation || '',
          order_index: index
        }))
        updateFormState({ answerOptions: enhancedOptions })
      }

      setEnhancementRequest('')
      toast.success('Question enhanced successfully!')
    } catch (error) {
      console.error('Enhancement error:', error)
      toast.error('Failed to enhance question')
    } finally {
      setIsEnhancing(false)
    }
  }

  // Handle fetching references from Semantic Scholar
  const handleFetchReferences = async () => {
    // Build search query: category (without "Pathology") + lesson/topic + title
    // Example: "Dermatopathology" + "Tricoepithelioma" + "Fibrofolliculoma"
    const searchParts: string[] = []

    // Add category if available (remove redundant "Pathology" words)
    if (formState.selectedContent?.category) {
      const category = formState.selectedContent.category
        .replace(/Anatomic Pathology/gi, '')
        .replace(/Clinical Pathology/gi, '')
        .replace(/Pathology/gi, '')
        .trim()
      if (category) {
        searchParts.push(category)
      }
    }

    // Add lesson/subject if available (this is the topic)
    if (formState.selectedContent?.subject) {
      searchParts.push(formState.selectedContent.subject)
    }

    // Add title, teaching point, or stem excerpt
    if (formState.title) {
      searchParts.push(formState.title)
    } else if (formState.teaching_point) {
      searchParts.push(formState.teaching_point)
    } else if (formState.stem) {
      // Use first 100 chars of stem as fallback
      searchParts.push(formState.stem.substring(0, 100))
    }

    if (searchParts.length === 0) {
      toast.error('Please add a question title, teaching point, or stem first')
      return
    }

    const searchTerms = searchParts.join(' ')

    setIsFetchingReferences(true)
    try {
      const response = await fetch('/api/admin/fetch-references', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerms: searchTerms.trim()
        }),
      })

      const data = await response.json()

      // Handle different response scenarios
      if (!response.ok) {
        // Rate limiting (429)
        if (response.status === 429) {
          toast.warning('Rate limited by Semantic Scholar. Please wait a moment and try again.', {
            duration: 4000
          })
          return
        }

        // Other errors
        toast.error(data.error || 'Failed to fetch references. Please try again.')
        return
      }

      // Success with references
      if (data.success && data.references && data.references.length > 0) {
        const referencesText = data.references.join('\n')
        updateFormState({ question_references: referencesText })

        if (data.cached) {
          toast.success(`Added ${data.references.length} cached references`)
        } else {
          toast.success(`Added ${data.references.length} references from Semantic Scholar`)
        }
      } else {
        // No references found
        toast.info('No references found for this topic. Try again in a moment or add references manually.')
      }
    } catch (error) {
      console.error('Fetch references error:', error)
      toast.error('Network error. Please check your connection and try again.')
    } finally {
      setIsFetchingReferences(false)
    }
  }


  // Handle answer option changes
  const updateAnswerOption = (index: number, field: string, value: any) => {
    const updatedOptions = [...formState.answerOptions]
    updatedOptions[index] = { ...updatedOptions[index], [field]: value }
    
    // If marking as correct, unmark others
    if (field === 'is_correct' && value === true) {
      updatedOptions.forEach((opt, i) => {
        if (i !== index) opt.is_correct = false
      })
    }
    
    updateFormState({ answerOptions: updatedOptions })
  }

  return (
    <div className="space-y-8">
      {/* Question Title */}
      <div className="space-y-2.5">
        <Label htmlFor="title" className="text-base font-semibold">Question Title</Label>
        <Input
          id="title"
          value={formState.title}
          onChange={(e) => updateFormState({ title: e.target.value })}
          placeholder="Brief descriptive title for the question"
          className="text-base"
        />
      </div>

      {/* Question Stem */}
      <div className="space-y-2.5">
        <Label htmlFor="stem" className="text-base font-semibold">Question Stem</Label>
        <Textarea
          id="stem"
          value={formState.stem}
          onChange={(e) => updateFormState({ stem: e.target.value })}
          placeholder="The main question text..."
          rows={6}
          className="text-base resize-none"
        />
      </div>

        {/* Answer Options */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Answer Options</Label>
          <div className="space-y-3">
            {formState.answerOptions.map((option, index) => (
              <Card
                key={index}
                className={`transition-all ${
                  option.is_correct
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Option Row */}
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct-answer"
                      checked={option.is_correct}
                      onChange={() => updateAnswerOption(index, 'is_correct', !option.is_correct)}
                      className="h-5 w-5 text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label className="text-sm font-semibold min-w-[70px] cursor-pointer" onClick={() => updateAnswerOption(index, 'is_correct', true)}>
                      Option {String.fromCharCode(65 + index)}
                    </Label>
                    <Input
                      value={option.text}
                      onChange={(e) => updateAnswerOption(index, 'text', e.target.value)}
                      placeholder="Answer option text..."
                      className="flex-1"
                    />
                    {option.is_correct && (
                      <Badge variant="default" className="ml-2 bg-primary">Correct</Badge>
                    )}
                  </div>

                  {/* Explanation Row */}
                  <div className="flex items-start gap-3 pl-8">
                    <Label className="text-xs text-muted-foreground min-w-[70px] pt-2">
                      Explanation
                    </Label>
                    <Textarea
                      value={option.explanation}
                      onChange={(e) => updateAnswerOption(index, 'explanation', e.target.value)}
                      placeholder="Explanation for this option..."
                      rows={2}
                      className="flex-1 text-sm resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Teaching Point */}
        <div className="space-y-2.5">
          <Label htmlFor="teaching_point" className="text-base font-semibold">Teaching Point</Label>
          <Textarea
            id="teaching_point"
            value={formState.teaching_point}
            onChange={(e) => updateFormState({ teaching_point: e.target.value })}
            placeholder="Key learning point or takeaway..."
            rows={4}
            className="resize-none"
          />
        </div>

        {/* References */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="question_references" className="text-base font-semibold">
              References <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchReferences}
              disabled={isFetchingReferences || (!formState.title && !formState.teaching_point && !formState.stem)}
              className="h-8"
            >
              {isFetchingReferences ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Fetch References
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="question_references"
            value={formState.question_references}
            onChange={(e) => updateFormState({ question_references: e.target.value })}
            placeholder="Citations, sources, or references..."
            rows={3}
            className="resize-none"
          />
        </div>

        {/* AI Enhancement Section */}
        <div className="border-t pt-8 mt-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                Enhance with AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Let AI improve your question's clarity, accuracy, and pedagogical value. The AI will use the context from your educational content to enhance the question.
              </p>

              <div className="space-y-2.5">
                <Label htmlFor="enhancement-request" className="text-sm font-medium">
                  Enhancement Request <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="enhancement-request"
                  placeholder="e.g., 'Make the question more challenging', 'Focus on differential diagnosis', 'Simplify the language'"
                  value={enhancementRequest}
                  onChange={(e) => setEnhancementRequest(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              <Button
                onClick={handleAIEnhancement}
                disabled={isEnhancing}
                className="w-full"
                variant="default"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enhance Question
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

    </div>
  )
}

