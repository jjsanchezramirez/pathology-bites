'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Upload, FileJson, Brain, AlertCircle } from 'lucide-react'
import { FormState } from '../multi-step-question-form'
import { ContentSelector } from '../content-selector'
import { ACTIVE_AI_MODELS } from '@/shared/config/ai-models'
import { createClient } from '@/shared/services/client'

interface StepSourceConfigProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
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

export function StepSourceConfig({ formState, updateFormState }: StepSourceConfigProps) {
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

    // Extract question data from JSON
    const questionData = {
      title: parsed.title || '',
      stem: parsed.stem || '',
      answerOptions: parsed.answer_options || parsed.answerOptions || [],
      teaching_point: parsed.teaching_point || parsed.teachingPoint || '',
      question_references: parsed.question_references || parsed.questionReferences || '',
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

  return (
    <div className="space-y-6">
      {/* JSON Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import from JSON
          </CardTitle>
          <CardDescription>
            Paste JSON data or drag and drop a JSON file to import question data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop JSON file here</p>
                <p className="text-xs text-muted-foreground">or paste JSON below</p>
              </div>
            </div>
          </div>

          <Textarea
            placeholder='{"title": "Question Title", "stem": "Question text...", ...}'
            value={formState.jsonData}
            onChange={(e) => handleJSONInput(e.target.value)}
            rows={8}
            className="font-mono text-sm"
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
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* AI Content Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Generate with AI
          </CardTitle>
          <CardDescription>
            Select educational content to generate a question using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentSelector
            selectedContent={formState.selectedContent}
            onContentSelected={handleContentSelected}
          />
        </CardContent>
      </Card>
    </div>
  )
}

