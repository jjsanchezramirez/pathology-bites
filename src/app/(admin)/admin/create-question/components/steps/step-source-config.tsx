'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Upload, FileJson, Brain, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormState } from '../multi-step-question-form'
import { ContentSelector } from '../content-selector'
import { ACTIVE_AI_MODELS } from '@/shared/config/ai-models'
import { createClient } from '@/shared/services/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Label } from '@/shared/components/ui/label'

interface StepSourceConfigProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
  onNext?: () => void
}

// Helper function to match or create tags from suggested tag names
async function matchOrCreateTags(suggestedTagNames: string[]): Promise<string[]> {
  const supabase = createClient()
  const tagIds: string[] = []

  for (const tagName of suggestedTagNames) {
    // Try to find existing tag
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id')
      .ilike('name', tagName)
      .limit(1)

    if (existingTags && existingTags.length > 0) {
      tagIds.push(existingTags[0].id)
    } else {
      // Create new tag
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single()

      if (newTag && !error) {
        tagIds.push(newTag.id)
      }
    }
  }

  return tagIds
}

// Helper function to find category ID by name
async function findCategoryIdByName(name: string): Promise<string | null> {
  const supabase = createClient()
  
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('categories')
    .select('id')
    .eq('name', name)
    .single()

  if (exactMatch) {
    return exactMatch.id
  }

  // Try case-insensitive match
  const { data: caseInsensitiveMatch } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .limit(1)

  if (caseInsensitiveMatch && caseInsensitiveMatch.length > 0) {
    return caseInsensitiveMatch[0].id
  }

  // Try partial match
  const { data: partialMatch } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)

  if (partialMatch && partialMatch.length > 0) {
    return partialMatch[0].id
  }

  console.warn(`⚠️ Category not found: "${name}"`)
  return null
}

// Helper function to find question set ID by name
async function findQuestionSetIdByName(name: string): Promise<string | null> {
  const supabase = createClient()
  
  const { data } = await supabase
    .from('question_sets')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)

  if (data && data.length > 0) {
    return data[0].id
  }

  console.warn(`⚠️ Question set not found: "${name}"`)
  return null
}

export function StepSourceConfig({ formState, updateFormState, onNext }: StepSourceConfigProps) {
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Parse and validate JSON
  const parseJSON = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString)
      setJsonError(null)
      return parsed
    } catch (error) {
      setJsonError('Invalid JSON format. Please check your input.')
      return null
    }
  }, [])

  // Handle JSON paste/input
  const handleJSONInput = useCallback(async (jsonString: string) => {
    updateFormState({ jsonData: jsonString })

    const parsed = parseJSON(jsonString)
    if (!parsed) return

    // Extract and normalize answer options from various possible field names
    let answerOptions = []
    const rawOptions = parsed.answer_options || parsed.answerOptions || parsed.question_options || parsed.options || []

    if (Array.isArray(rawOptions)) {
      answerOptions = rawOptions.map((option, index) => ({
        text: option.text || option.answer || option.choice || '',
        is_correct: option.is_correct || option.isCorrect || option.correct || false,
        explanation: option.explanation || option.rationale || option.feedback || '',
        order_index: option.order_index !== undefined ? option.order_index : index
      }))
    }

    // Ensure we have exactly 5 answer options (A, B, C, D, E)
    while (answerOptions.length < 5) {
      answerOptions.push({
        text: '',
        is_correct: false,
        explanation: '',
        order_index: answerOptions.length
      })
    }

    // Extract question data from JSON with comprehensive field mapping
    const questionData = {
      title: parsed.title || '',
      stem: parsed.stem || parsed.question || parsed.body || '',
      answerOptions: answerOptions,
      teaching_point: parsed.teaching_point || parsed.teachingPoint || parsed.learning_objective || parsed.key_point || '',
      question_references: parsed.question_references || parsed.questionReferences || parsed.references || parsed.citations || '',
      questionImages: parsed.question_images || parsed.questionImages || [],
      difficulty: parsed.difficulty || 'medium',
      status: parsed.status || 'draft'
    }

    // Handle category
    if (parsed.category_id) {
      questionData.category_id = parsed.category_id
    } else if (parsed.category) {
      const categoryId = await findCategoryIdByName(parsed.category)
      if (categoryId) questionData.category_id = categoryId
    }

    // Handle question set
    if (parsed.question_set_id) {
      questionData.question_set_id = parsed.question_set_id
    } else if (parsed.question_set || parsed.questionSet) {
      const setId = await findQuestionSetIdByName(parsed.question_set || parsed.questionSet)
      if (setId) questionData.question_set_id = setId
    }

    // Handle tags
    if (parsed.tag_ids) {
      questionData.tag_ids = parsed.tag_ids
    } else if (parsed.tags && Array.isArray(parsed.tags)) {
      const tagIds = await matchOrCreateTags(parsed.tags)
      questionData.tag_ids = tagIds
    }

    updateFormState(questionData)
  }, [parseJSON, updateFormState])

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/json') {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        handleJSONInput(content)
      }
      reader.readAsText(file)
    }
  }, [handleJSONInput])

  // Handle AI content selection
  const handleContentSelected = (content: any) => {
    updateFormState({ selectedContent: content })
  }

  // Handle AI question generation from educational content
  const handleGenerateFromContent = async () => {
    if (!formState.selectedAIModel) {
      toast.error('Please select an AI model first')
      return
    }

    if (!formState.selectedContent) {
      toast.error('Please select educational content first')
      return
    }

    setIsGenerating(true)
    try {
      console.log('🤖 Generating question from educational content:', formState.selectedContent)

      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'educational_content',
          content: formState.selectedContent,
          instructions: 'Generate a comprehensive pathology question with 5 answer options (A, B, C, D, E) based on the provided educational content. Include detailed explanations for all answer options.',
          model: formState.selectedAIModel
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI generation failed:', response.status, errorText)

        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate question`)
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to generate question'}`)
        }
      }

      const data = await response.json()
      console.log('🎯 AI generation response:', data)

      // Extract and normalize the generated question data
      const generatedData = {
        title: data.title || '',
        stem: data.stem || data.question || '',
        answerOptions: data.answer_options || data.question_options || [],
        teaching_point: data.teaching_point || '',
        question_references: data.question_references || data.references || '',
        difficulty: data.difficulty || 'medium',
        status: data.status || 'draft'
      }

      // Ensure answer options are properly formatted
      if (generatedData.answerOptions.length > 0) {
        generatedData.answerOptions = generatedData.answerOptions.map((option, index) => ({
          text: option.text || '',
          is_correct: option.is_correct || false,
          explanation: option.explanation || '',
          order_index: index
        }))
      }

      updateFormState(generatedData)
      toast.success('Question generated successfully! Advancing to edit step...')

      // Auto-advance to Step 2 (Content Edit) after successful generation
      setTimeout(() => {
        if (onNext) {
          onNext()
        }
      }, 1500) // Small delay to show success message

    } catch (error) {
      console.error('AI generation error:', error)
      toast.error(`Failed to generate question: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const [isGenerating, setIsGenerating] = useState(false)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* JSON Import Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileJson className="h-5 w-5 text-blue-600" />
            </div>
            Import from JSON
          </CardTitle>
          <CardDescription>
            Paste JSON from WSI Question Generator or drag & drop file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 transition-all ${
              isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted hover:border-muted-foreground/30'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop JSON file here</p>
                <p className="text-xs text-muted-foreground mt-1">or paste in the text area below</p>
              </div>
            </div>
          </div>

          <Textarea
            placeholder='{"title": "Question Title", "stem": "Question text...", ...}'
            value={formState.jsonData}
            onChange={(e) => handleJSONInput(e.target.value)}
            rows={5}
            className="font-mono text-xs resize-none"
          />

          {jsonError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{jsonError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* OR Divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-sm uppercase">
          <span className="bg-background px-4 text-muted-foreground font-medium">Or</span>
        </div>
      </div>

      {/* AI Generation from Educational Content */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            AI Generation from Educational Content
          </CardTitle>
          <CardDescription>
            Select AI model and educational content to generate a question
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Model Selection */}
          <div className="space-y-3">
            <Label htmlFor="ai-model" className="text-base font-semibold">AI Model</Label>
            <Select
              value={formState.selectedAIModel || ''}
              onValueChange={(value) => updateFormState({ selectedAIModel: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select an AI model..." />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_AI_MODELS.filter(model => model.available).map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground ml-3">
                        {model.provider}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.selectedAIModel && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Selected: {ACTIVE_AI_MODELS.find(m => m.id === formState.selectedAIModel)?.name}
              </p>
            )}
          </div>

          {/* Content Selection - Only show if model is selected */}
          {formState.selectedAIModel && (
            <>
              <div className="border-t pt-6 space-y-3">
                <Label className="text-base font-semibold">Educational Content</Label>
                <ContentSelector
                  selectedContent={formState.selectedContent}
                  onContentSelect={handleContentSelected}
                />
              </div>

              {formState.selectedContent && (
                <div className="pt-6 border-t space-y-3">
                  <Button
                    onClick={handleGenerateFromContent}
                    disabled={isGenerating}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating Question...
                      </>
                    ) : (
                      <>
                        <Brain className="h-5 w-5 mr-2" />
                        Generate Question with AI
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Using <span className="font-medium">{ACTIVE_AI_MODELS.find(m => m.id === formState.selectedAIModel)?.name}</span> to create a complete question with 5 answer options and explanations
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

