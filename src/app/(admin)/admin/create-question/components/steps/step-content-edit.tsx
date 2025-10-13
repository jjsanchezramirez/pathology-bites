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
      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions: chatMessage,
          currentQuestion: {
            title: formState.title,
            stem: formState.stem,
            answer_options: formState.answerOptions,
            teaching_point: formState.teaching_point,
            question_references: formState.question_references
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refine question')
      }

      const data = await response.json()
      
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
    } catch (error) {
      console.error('AI refinement error:', error)
      toast.error('Failed to refine question')
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
      {/* AI Refinement Chat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Refinement Assistant
          </CardTitle>
          <CardDescription>
            Ask AI to refine or improve any part of the question
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="e.g., 'Make the stem more concise' or 'Add more detail to the teaching point'"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAIRefinement}
              disabled={isRefining || !chatMessage.trim()}
              size="lg"
            >
              {isRefining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refining...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Refine
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
      <div className="space-y-4">
        <Label>Answer Options</Label>
        {formState.answerOptions.map((option, index) => (
          <Card key={index} className={option.is_correct ? 'border-green-500' : ''}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Option {String.fromCharCode(65 + index)}
                  {option.is_correct && (
                    <Badge variant="default" className="ml-2">Correct</Badge>
                  )}
                </Label>
                <Button
                  variant={option.is_correct ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateAnswerOption(index, 'is_correct', !option.is_correct)}
                >
                  {option.is_correct ? 'Correct' : 'Mark as Correct'}
                </Button>
              </div>
              
              <Textarea
                value={option.text}
                onChange={(e) => updateAnswerOption(index, 'text', e.target.value)}
                placeholder="Answer option text..."
                rows={2}
              />
              
              <Textarea
                value={option.explanation}
                onChange={(e) => updateAnswerOption(index, 'explanation', e.target.value)}
                placeholder="Explanation for this option..."
                rows={2}
              />
            </CardContent>
          </Card>
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
    </div>
  )
}

