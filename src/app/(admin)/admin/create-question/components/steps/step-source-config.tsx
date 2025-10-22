'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Upload, FileJson, Brain, AlertCircle, Loader2, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { FormState } from '../multi-step-question-form'
import { ContentSelector } from '../content-selector'
import { ACTIVE_AI_MODELS } from '@/shared/config/ai-models'
import { createClient } from '@/shared/services/client'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { getCategoryIdFromContent } from '../../utils/category-mapping'

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [additionalContent, setAdditionalContent] = useState('')

  // Auto-select first AI model on mount
  useEffect(() => {
    if (!formState.selectedAIModel && ACTIVE_AI_MODELS.length > 0) {
      const firstAvailableModel = ACTIVE_AI_MODELS.find(m => m.available)
      if (firstAvailableModel) {
        updateFormState({ selectedAIModel: firstAvailableModel.id })
      }
    }
  }, [])

  // Parse and validate JSON
  const parseJSON = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString)
      setJsonError(null)
      return parsed
    } catch {
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
          additionalContext: additionalContent,
          instructions: 'Generate a comprehensive pathology question with 5 answer options (A, B, C, D, E) based on the provided educational content. IMPORTANT: Assume there is a histologic image attached and do NOT describe the image in the question stem. Include detailed explanations for all answer options.',
          model: formState.selectedAIModel
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI generation failed:', response.status, errorText)

        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate question`)
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to generate question'}`)
        }
      }

      const data = await response.json()
      console.log('🎯 AI generation response:', data)

      // Extract and normalize the generated question data
      const generatedData: any = {
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

      // Auto-assign category based on educational content mapping
      if (!generatedData.category_id && formState.selectedContent) {
        const categoryId = getCategoryIdFromContent(
          formState.selectedContent.category,
          formState.selectedContent.subject
        )
        if (categoryId) {
          generatedData.category_id = categoryId
          console.log('✅ Auto-assigned category from content mapping:', categoryId)
        }
      }

      // Fallback: Auto-assign category based on AI context
      if (!generatedData.category_id && data.category_id) {
        generatedData.category_id = data.category_id
      } else if (!generatedData.category_id && data.category) {
        const categoryId = await findCategoryIdByName(data.category)
        if (categoryId) generatedData.category_id = categoryId
      }

      // Auto-assign question set to AI model name
      if (formState.selectedAIModel) {
        const modelName = ACTIVE_AI_MODELS.find(m => m.id === formState.selectedAIModel)?.name
        if (modelName) {
          const setId = await findQuestionSetIdByName(modelName)
          if (setId) generatedData.question_set_id = setId
        }
      }

      // Auto-suggest tags based on AI response
      if (data.suggested_tags && Array.isArray(data.suggested_tags)) {
        const tagIds = await matchOrCreateTags(data.suggested_tags)
        if (tagIds.length > 0) generatedData.tag_ids = tagIds
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* AI Model Selection Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-blue-600" />
            Select AI Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={formState.selectedAIModel || ''} onValueChange={(value) => updateFormState({ selectedAIModel: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an AI model..." />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_AI_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* AI Generation from Educational Content - FIRST */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            Generate with AI
          </CardTitle>
          <CardDescription>
            Create a question using AI based on educational content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Educational Content Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Educational Content</Label>
            <ContentSelector
              selectedContent={formState.selectedContent}
              onContentSelect={handleContentSelected}
            />
          </div>

          {/* Additional Content */}
          <div className="space-y-3">
            <Label htmlFor="additional-content" className="text-base font-semibold">
              Additional Context <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="additional-content"
              placeholder="Add any additional instructions or context for the AI (e.g., 'Focus on differential diagnosis', 'Include clinical presentation')"
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateFromContent}
            disabled={isGenerating || !formState.selectedContent}
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

      {/* JSON Import Section - SIMPLIFIED */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileJson className="h-5 w-5 text-blue-600" />
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

      {/* OR Divider for Manual Creation */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-sm uppercase">
          <span className="bg-background px-4 text-muted-foreground font-medium">Or</span>
        </div>
      </div>

      {/* Manual Creation Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Edit3 className="h-5 w-5 text-green-600" />
            Create Manually
          </CardTitle>
          <CardDescription>
            Skip this step and create your question manually in the next section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You can proceed to the next step to manually enter all question details, including title, stem, answer options, and explanations.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

