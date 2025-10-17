'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Brain, Loader2, Sparkles } from 'lucide-react'
import { FormState } from '../multi-step-question-form'
import { TagAutocomplete } from '../tag-autocomplete'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'

interface StepMetadataProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
  initialQuestionSetId?: string
}

interface Category {
  id: string
  name: string
  created_at: string
}

interface QuestionSet {
  id: string
  name: string
  created_at: string
}

interface Tag {
  id: string
  name: string
  created_at: string
}

export function StepMetadata({ formState, updateFormState, initialQuestionSetId }: StepMetadataProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(true)
  const [loadingTags, setLoadingTags] = useState(true)
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [hasAutoAssignedQuestionSet, setHasAutoAssignedQuestionSet] = useState(false)

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, created_at')
        .order('name')

      if (data && !error) {
        setCategories(data)
      }
      setLoadingCategories(false)
    }

    fetchCategories()
  }, [])

  // Fetch question sets
  useEffect(() => {
    const fetchQuestionSets = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('question_sets')
        .select('id, name, created_at')
        .order('name')

      if (data && !error) {
        setQuestionSets(data)
      }
      setLoadingQuestionSets(false)
    }

    fetchQuestionSets()
  }, [])

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, created_at')
        .order('name')

      if (data && !error) {
        setTags(data)
      }
      setLoadingTags(false)
    }

    fetchTags()
  }, [])

  // Auto-assign question set if provided and not already set
  useEffect(() => {
    if (
      !formState.question_set_id &&
      !hasAutoAssignedQuestionSet &&
      !loadingQuestionSets &&
      questionSets.length > 0
    ) {
      // If there's an initial question set ID, use that
      if (initialQuestionSetId) {
        updateFormState({ question_set_id: initialQuestionSetId })
        setHasAutoAssignedQuestionSet(true)
        console.log('Auto-assigned question set from initial data:', initialQuestionSetId)
      } else {
        // Otherwise, auto-assign PathOutlines as the default
        const pathOutlinesSet = questionSets.find(set => set.name === 'PathOutlines')
        if (pathOutlinesSet) {
          updateFormState({ question_set_id: pathOutlinesSet.id })
          setHasAutoAssignedQuestionSet(true)
          console.log('Auto-assigned default question set: PathOutlines')
        }
      }
    }
  }, [initialQuestionSetId, formState.question_set_id, hasAutoAssignedQuestionSet, loadingQuestionSets, questionSets, updateFormState])

  // Auto-suggest metadata based on question content
  const handleAIMetadataSuggestion = async () => {
    if (!formState.title || !formState.stem) {
      toast.error('Please fill in the question title and stem first')
      return
    }

    setIsGeneratingMetadata(true)
    try {
      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'metadata_suggestion',
          content: {
            title: formState.title,
            stem: formState.stem,
            teaching_point: formState.teaching_point,
            available_categories: categories.map(c => ({ id: c.id, name: c.name })),
            available_question_sets: questionSets.map(qs => ({ id: qs.id, name: qs.name })),
            available_tags: tags.map(t => ({ id: t.id, name: t.name }))
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate metadata suggestions')
      }

      const result = await response.json()

      // Apply AI suggestions
      if (result.category_id) {
        updateFormState({ category_id: result.category_id })
      }
      if (result.question_set_id) {
        updateFormState({ question_set_id: result.question_set_id })
      }
      if (result.difficulty) {
        updateFormState({ difficulty: result.difficulty })
      }
      if (result.suggested_tag_ids && result.suggested_tag_ids.length > 0) {
        updateFormState({ tag_ids: result.suggested_tag_ids })
      }

      toast.success('AI metadata suggestions applied!')
    } catch (error) {
      console.error('Error generating metadata suggestions:', error)
      toast.error('Failed to generate metadata suggestions')
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* AI Metadata Suggestion Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-base mb-1">AI Metadata Suggestions</h3>
                <p className="text-sm text-muted-foreground">
                  Let AI analyze your question content and suggest appropriate category, question set, difficulty, and tags.
                </p>
              </div>
              <Button
                onClick={handleAIMetadataSuggestion}
                disabled={isGeneratingMetadata || !formState.title || !formState.stem}
                variant="default"
                size="default"
              >
                {isGeneratingMetadata ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Suggest All Metadata
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Selection */}
      <div className="space-y-3">
        <Label htmlFor="category" className="text-base font-semibold">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formState.category_id}
          onValueChange={(value) => updateFormState({ category_id: value })}
        >
          <SelectTrigger id="category" className="h-11">
            <SelectValue placeholder={loadingCategories ? "Loading..." : "Select a category"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Question Set Selection */}
      <div className="space-y-3">
        <Label htmlFor="question_set" className="text-base font-semibold">
          Question Set <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formState.question_set_id}
          onValueChange={(value) => updateFormState({ question_set_id: value })}
        >
          <SelectTrigger id="question_set" className="h-11">
            <SelectValue placeholder={loadingQuestionSets ? "Loading..." : "Select a question set"} />
          </SelectTrigger>
          <SelectContent>
            {questionSets.map((set) => (
              <SelectItem key={set.id} value={set.id}>
                {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Difficulty Selection */}
      <div className="space-y-3">
        <Label htmlFor="difficulty" className="text-base font-semibold">Difficulty</Label>
        <Select
          value={formState.difficulty}
          onValueChange={(value: 'easy' | 'medium' | 'hard') => updateFormState({ difficulty: value })}
        >
          <SelectTrigger id="difficulty" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Easy
              </div>
            </SelectItem>
            <SelectItem value="medium">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                Medium
              </div>
            </SelectItem>
            <SelectItem value="hard">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Hard
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Tags <span className="text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <TagAutocomplete
          selectedTags={formState.tag_ids}
          onTagsChange={(tagIds) => updateFormState({ tag_ids: tagIds })}
          allTags={tags}
          onTagCreated={(newTag) => setTags(prev => [...prev, newTag])}
        />
      </div>
    </div>
  )
}

