'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Brain, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormState } from '../multi-step-question-form'

interface StepContentEditProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
}

export function StepContentEdit({ formState, updateFormState }: StepContentEditProps) {
  const [chatMessage, setChatMessage] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  // Debug: Log formState when component mounts or updates
  console.log('📝 StepContentEdit - Current formState:', {
    title: formState.title,
    stem: formState.stem?.substring(0, 50) + '...',
    answerOptionsCount: formState.answerOptions?.length,
    answerOptions: formState.answerOptions,
    teaching_point: formState.teaching_point?.substring(0, 50) + '...'
  })

  // Handle AI refinement
  const handleAIRefinement = async () => {
    if (!chatMessage.trim()) {
      toast.error('Please enter a refinement request')
      return
    }

    setIsRefining(true)
    try {
      const requestBody = {
        mode: 'refinement',
        instructions: chatMessage,
        currentQuestion: {
          title: formState.title,
          stem: formState.stem,
          answer_options: formState.answerOptions,
          teaching_point: formState.teaching_point,
          question_references: formState.question_references
        },
        model: 'Llama-3.3-8B-Instruct' // Use fast model for refinements
      }

      console.log('Sending refinement request:', requestBody)

      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('API Error:', response.status, errorData)
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to refine question`)
      }

      const data = await response.json()
      console.log('Refinement response:', data)

      // Check if we got valid data back
      if (!data || (!data.stem && !data.title)) {
        throw new Error('Invalid response from AI service')
      }

      // Update form state with refined content
      updateFormState({
        title: data.title || formState.title,
        stem: data.stem || formState.stem,
        answerOptions: data.answer_options || formState.answerOptions,
        teaching_point: data.teaching_point || formState.teaching_point,
        question_references: data.question_references || formState.question_references
      })

      toast.success('Question refined successfully!')
      setChatMessage('')
      setShowRefinementDialog(false)
    } catch (error) {
      console.error('AI refinement error:', error)
      toast.error(`Failed to refine question: ${error.message}`)
    } finally {
      setIsRefining(false)
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
    <div className="space-y-6">


      {/* Question Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Question Title</Label>
        <Input
          id="title"
          value={formState.title}
          onChange={(e) => updateFormState({ title: e.target.value })}
          placeholder="Brief descriptive title for the question"
        />
      </div>

      {/* Question Stem */}
      <div className="space-y-2">
        <Label htmlFor="stem">Question Stem</Label>
        <Textarea
          id="stem"
          value={formState.stem}
          onChange={(e) => updateFormState({ stem: e.target.value })}
          placeholder="The main question text..."
          rows={6}
        />
      </div>

      {/* Answer Options */}
      <div className="space-y-3">
        <Label>Answer Options</Label>
        {formState.answerOptions.map((option, index) => (
          <div key={index} className={`border rounded-lg p-3 space-y-2 ${option.is_correct ? 'border-green-500 bg-green-50' : 'border-border'}`}>
            {/* Option Row */}
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="correct-answer"
                checked={option.is_correct}
                onChange={() => updateAnswerOption(index, 'is_correct', !option.is_correct)}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <Label className="text-sm font-medium min-w-[60px]">
                Option {String.fromCharCode(65 + index)}:
              </Label>
              <Input
                value={option.text}
                onChange={(e) => updateAnswerOption(index, 'text', e.target.value)}
                placeholder="Answer option text..."
                className="flex-1"
              />
              {option.is_correct && (
                <Badge variant="default" className="ml-2">Correct</Badge>
              )}
            </div>

            {/* Explanation Row */}
            <div className="flex items-start gap-3">
              <div className="w-4"></div> {/* Spacer to align with radio button */}
              <Label className="text-xs text-muted-foreground min-w-[60px] pt-1">
                Explanation:
              </Label>
              <Textarea
                value={option.explanation}
                onChange={(e) => updateAnswerOption(index, 'explanation', e.target.value)}
                placeholder="Explanation for this option..."
                rows={1}
                className="flex-1 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Teaching Point */}
      <div className="space-y-2">
        <Label htmlFor="teaching_point">Teaching Point</Label>
        <Textarea
          id="teaching_point"
          value={formState.teaching_point}
          onChange={(e) => updateFormState({ teaching_point: e.target.value })}
          placeholder="Key learning point or takeaway..."
          rows={4}
        />
      </div>

      {/* References */}
      <div className="space-y-2">
        <Label htmlFor="question_references">References (Optional)</Label>
        <Textarea
          id="question_references"
          value={formState.question_references}
          onChange={(e) => updateFormState({ question_references: e.target.value })}
          placeholder="Citations, sources, or references..."
          rows={3}
        />
      </div>

      {/* AI Refinement */}
      <div className="space-y-2 pt-4 border-t">
        <Label htmlFor="ai_refinement">Refine Question with AI</Label>
        <div className="flex gap-2">
          <Textarea
            id="ai_refinement"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="e.g., 'Make the stem more concise' or 'Add more clinical context'"
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={handleAIRefinement}
            disabled={isRefining || !chatMessage.trim()}
            className="self-end"
          >
            {isRefining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Refine
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

