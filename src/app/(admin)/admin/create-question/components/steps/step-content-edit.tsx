'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
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
  const [categories, setCategories] = useState<Category[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  // Determine which AI model to use for refinement
  // Priority: 1. Question set's AI model, 2. Selected AI model from Step 1, 3. Default fast model
  const refinementModel = questionSetAIModel || formState.selectedAIModel || 'Llama-3.3-8B-Instruct'

  // Get friendly model name for display
  const modelInfo = getModelById(refinementModel)
  const modelDisplayName = modelInfo?.name || refinementModel

  // Fetch metadata for AI quick actions
  useEffect(() => {
    const fetchMetadata = async () => {
      const supabase = createClient()

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .order('name')

      // Fetch question sets
      const { data: questionSetsData } = await supabase
        .from('question_sets')
        .select('id, name')
        .order('name')

      // Fetch tags
      const { data: tagsData } = await supabase
        .from('tags')
        .select('id, name')
        .order('name')

      if (categoriesData) setCategories(categoriesData)
      if (questionSetsData) setQuestionSets(questionSetsData)
      if (tagsData) setTags(tagsData)
    }

    fetchMetadata()
  }, [])

  // Debug: Log formState when component mounts or updates
  console.log('📝 StepContentEdit - Current formState:', {
    title: formState.title,
    stem: formState.stem?.substring(0, 50) + '...',
    answerOptionsCount: formState.answerOptions?.length,
    answerOptions: formState.answerOptions,
    teaching_point: formState.teaching_point?.substring(0, 50) + '...',
    refinementModel,
    modelDisplayName
  })

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
          <Label htmlFor="question_references" className="text-base font-semibold">
            References <span className="text-muted-foreground font-normal">(Optional)</span>
          </Label>
          <Textarea
            id="question_references"
            value={formState.question_references}
            onChange={(e) => updateFormState({ question_references: e.target.value })}
            placeholder="Citations, sources, or references..."
            rows={3}
            className="resize-none"
          />
        </div>

    </div>
  )
}

