'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { FormState } from '../multi-step-question-form'
import { TagAutocomplete } from '../tag-autocomplete'
import { createClient } from '@/shared/services/client'

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

  return (
    <div className="space-y-6">
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

      {/* Status Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="status">Question Status</Label>
            <Select
              value={formState.status}
              onValueChange={(value) => updateFormState({ status: value })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

