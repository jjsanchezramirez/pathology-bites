'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Brain, Loader2 } from 'lucide-react'
import { FormState } from '../multi-step-question-form'
import { TagAutocomplete } from '../tag-autocomplete'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'

interface StepMetadataProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
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

export function StepMetadata({ formState, updateFormState }: StepMetadataProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(true)
  const [loadingTags, setLoadingTags] = useState(true)
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)

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
    <div className="space-y-6">
      {/* AI Metadata Suggestion */}
      <Card>
        <CardHeader>
          <CardTitle>AI Metadata Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Let AI analyze your question content and suggest appropriate category, question set, difficulty, and tags.
            </p>
            <Button
              onClick={handleAIMetadataSuggestion}
              disabled={isGeneratingMetadata || !formState.title || !formState.stem}
              variant="outline"
            >
              {isGeneratingMetadata ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Suggest Metadata
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="category">Select Category *</Label>
            <Select
              value={formState.category_id}
              onValueChange={(value) => updateFormState({ category_id: value })}
            >
              <SelectTrigger id="category">
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
        </CardContent>
      </Card>

      {/* Question Set Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Question Set</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="question_set">Select Question Set *</Label>
            <Select
              value={formState.question_set_id}
              onValueChange={(value) => updateFormState({ question_set_id: value })}
            >
              <SelectTrigger id="question_set">
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
        </CardContent>
      </Card>

      {/* Difficulty Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Difficulty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Select Difficulty</Label>
            <Select
              value={formState.difficulty}
              onValueChange={(value: 'easy' | 'medium' | 'hard') => updateFormState({ difficulty: value })}
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagAutocomplete
            selectedTags={formState.tag_ids}
            onTagsChange={(tagIds) => updateFormState({ tag_ids: tagIds })}
            allTags={tags}
            onTagCreated={(newTag) => setTags(prev => [...prev, newTag])}
          />
        </CardContent>
      </Card>


    </div>
  )
}

