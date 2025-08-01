'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/shared/services/client'
import { useSharedAuth } from '@/shared/hooks/use-shared-auth'
import { toast } from 'sonner'
import { getCategoryIdFromPathPrimer } from '../utils/category-mapping'

interface GeneratedQuestion {
  title: string
  stem: string
  difficulty: 'easy' | 'medium' | 'hard'
  teaching_point: string
  question_references: string
  status: string
  question_set_id: string
  category_id: string
  suggested_tags?: string[]
  answer_options: Array<{
    text: string
    is_correct: boolean
    explanation: string
    order_index: number
  }>
  question_images: Array<{
    question_section: 'stem' | 'explanation'
    order_index: number
    image_url: string
    alt_text: string
    caption: string
  }>
  tag_ids: string[]
  metadata: any
}

interface ImageAttachment {
  image_id: string
  question_section: 'stem' | 'explanation'
  order_index: number
}

interface QuestionFinalizationProps {
  question: GeneratedQuestion | null
  uploadedFiles: File[]
  attachedImages: ImageAttachment[]
  onQuestionCreated: () => void
}

interface Category {
  id: string
  name: string
  level: number
  parent_id: string | null
}

interface Tag {
  id: string
  name: string
}

interface QuestionSet {
  id: string
  name: string
  source_type: string
}

export function QuestionFinalization({ question, uploadedFiles, attachedImages, onQuestionCreated }: QuestionFinalizationProps) {
  const { user } = useSharedAuth()
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<string>('')
  const [newTagName, setNewTagName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Function to automatically assign category based on PathPrimer content
  const getAutoCategoryId = (sourceContent: any): string => {
    if (!sourceContent) return ''

    const { category, subject } = sourceContent

    // Use the proper mapping function
    const categoryId = getCategoryIdFromPathPrimer(category, subject)

    if (categoryId) {
      console.log(`Auto-mapped PathPrimer "${category} > ${subject}" to category ID: ${categoryId}`)
      return categoryId
    }

    console.warn(`No mapping found for PathPrimer "${category} > ${subject}"`)
    return ''
  }

  // Function to automatically assign question set based on AI model
  const getAutoQuestionSetId = (aiModel: string, availableQuestionSets: QuestionSet[]): string => {
    if (!availableQuestionSets.length) {
      console.log('No question sets available for auto-selection')
      return ''
    }

    console.log('Available question sets:', availableQuestionSets.map(s => ({ name: s.name, source_type: s.source_type })))

    let setName = 'AI Generated'
    let specificSetNames: string[] = []

    if (aiModel?.startsWith('gemini-')) {
      setName = 'AI Generated - Gemini'
      specificSetNames = ['AI Generated - Gemini', 'Gemini', 'AI - Gemini']
    } else if (aiModel?.startsWith('claude-')) {
      setName = 'AI Generated - Claude'
      specificSetNames = ['AI Generated - Claude', 'Claude', 'AI - Claude']
    } else if (aiModel?.startsWith('gpt-')) {
      setName = 'AI Generated - ChatGPT'
      specificSetNames = ['AI Generated - ChatGPT', 'ChatGPT', 'AI - ChatGPT', 'AI Generated - GPT']
    } else if (aiModel?.startsWith('mistral-') || aiModel?.startsWith('open-mistral')) {
      setName = 'AI Generated - Mistral'
      specificSetNames = ['AI Generated - Mistral', 'Mistral', 'AI - Mistral']
    } else if (aiModel?.startsWith('deepseek-')) {
      setName = 'AI Generated - DeepSeek'
      specificSetNames = ['AI Generated - DeepSeek', 'DeepSeek', 'AI - DeepSeek']
    }

    // Try to find exact match first
    for (const specificName of specificSetNames) {
      const exactMatch = availableQuestionSets.find(set =>
        set.name.toLowerCase() === specificName.toLowerCase()
      )
      if (exactMatch) {
        console.log('Found exact match for question set:', exactMatch.name)
        return exactMatch.id
      }
    }

    // Try to find partial match
    for (const specificName of specificSetNames) {
      const partialMatch = availableQuestionSets.find(set =>
        set.name.toLowerCase().includes(specificName.toLowerCase())
      )
      if (partialMatch) {
        console.log('Found partial match for question set:', partialMatch.name)
        return partialMatch.id
      }
    }

    // Fallback to any AI-generated set
    const aiGeneratedSet = availableQuestionSets.find(set =>
      set.source_type === 'ai_generated'
    )
    if (aiGeneratedSet) {
      console.log('Found AI-generated set:', aiGeneratedSet.name)
      return aiGeneratedSet.id
    }

    // Final fallback to any set with "AI" in the name
    const aiNamedSet = availableQuestionSets.find(set =>
      set.name.toLowerCase().includes('ai') || set.name.toLowerCase().includes('generated')
    )
    if (aiNamedSet) {
      console.log('Found AI-named set:', aiNamedSet.name)
      return aiNamedSet.id
    }

    console.log('No suitable question set found for AI model:', aiModel)
    return ''
  }

  // Load categories, tags, and question sets
  useEffect(() => {
    const loadData = async () => {
      try {
        let loadedCategories: Category[] = []
        let loadedTags: Tag[] = []
        let loadedQuestionSets: QuestionSet[] = []

        // Load categories with better error handling
        console.log('Loading categories...')
        const categoriesResponse = await fetch('/api/admin/categories?page=0&pageSize=1000')
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          console.log('Categories loaded:', categoriesData.categories?.length || 0)
          loadedCategories = categoriesData.categories || []
          setCategories(loadedCategories)
        } else {
          const errorData = await categoriesResponse.json()
          console.error('Categories API error:', errorData)
          toast.error(`Failed to load categories: ${errorData.error || 'Unknown error'}`)
        }

        // Load tags with better error handling - limit to 10 most recently used
        console.log('Loading recent tags...')
        const tagsResponse = await fetch('/api/admin/tags?page=0&pageSize=10&sortBy=recent')
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          console.log('Recent tags loaded:', tagsData.tags?.length || 0)
          loadedTags = tagsData.tags || []
          setTags(loadedTags)
        } else {
          const errorData = await tagsResponse.json()
          console.error('Tags API error:', errorData)
          toast.error(`Failed to load tags: ${errorData.error || 'Unknown error'}`)
        }

        // Load question sets with better error handling
        console.log('Loading question sets...')
        const setsResponse = await fetch('/api/admin/question-sets?page=0&pageSize=1000')
        if (setsResponse.ok) {
          const setsData = await setsResponse.json()
          console.log('Question sets loaded:', setsData.questionSets?.length || 0)
          loadedQuestionSets = setsData.questionSets || []
          setQuestionSets(loadedQuestionSets)

          // Auto-select question set based on AI model
          const aiModel = question?.metadata?.generated_by?.model || ''
          console.log('AI model for auto-selection:', aiModel)

          const autoQuestionSetId = getAutoQuestionSetId(aiModel, loadedQuestionSets)
          if (autoQuestionSetId) {
            setSelectedQuestionSet(autoQuestionSetId)
            const selectedSet = loadedQuestionSets.find((set: QuestionSet) => set.id === autoQuestionSetId)
            console.log('Auto-selected question set:', selectedSet?.name, 'ID:', autoQuestionSetId)
          } else {
            // Fallback to any AI-generated set
            const aiSet = loadedQuestionSets.find((set: QuestionSet) =>
              set.source_type === 'ai_generated'
            )
            if (aiSet) {
              setSelectedQuestionSet(aiSet.id)
              console.log('Auto-selected fallback AI question set:', aiSet.name, 'ID:', aiSet.id)
            } else {
              // Final fallback - try to find any set with "AI" in the name
              const aiNamedSet = loadedQuestionSets.find((set: QuestionSet) =>
                set.name.toLowerCase().includes('ai') || set.name.toLowerCase().includes('generated')
              )
              if (aiNamedSet) {
                setSelectedQuestionSet(aiNamedSet.id)
                console.log('Auto-selected AI-named question set:', aiNamedSet.name, 'ID:', aiNamedSet.id)
              } else {
                console.log('No suitable AI question set found for auto-selection')
              }
            }
          }
        } else {
          const errorData = await setsResponse.json()
          console.error('Question sets API error:', errorData)
          toast.error(`Failed to load question sets: ${errorData.error || 'Unknown error'}`)
        }

        // Auto-assign category based on PathPrimer content after all data is loaded
        const sourceContent = question?.metadata?.source_content
        const autoCategoryId = getAutoCategoryId(sourceContent)
        if (autoCategoryId) {
          setSelectedCategory(autoCategoryId)
          const selectedCat = loadedCategories.find((cat: Category) => cat.id === autoCategoryId)
          console.log('Auto-selected category:', selectedCat?.name)
        }

        // Auto-assign tags if they exist in the question metadata
        if (question?.suggested_tags && question.suggested_tags.length > 0) {
          const suggestedTagIds: string[] = []

          for (const suggestedTag of question.suggested_tags) {
            // Try to find existing tag (case-insensitive)
            let existingTag = loadedTags.find((tag: Tag) =>
              tag.name.toLowerCase().trim() === suggestedTag.toLowerCase().trim()
            )

            // If tag doesn't exist, create it
            if (!existingTag) {
              try {
                const response = await fetch('/api/admin/tags', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: suggestedTag.trim() })
                })

                if (response.ok) {
                  const result = await response.json()
                  existingTag = result.tag
                  if (existingTag) {
                    setTags(prev => [...prev, existingTag!])
                    console.log('Created new tag:', existingTag.name)
                  }
                } else if (response.status === 409) {
                  // Tag already exists (409 conflict), try to find it again
                  console.log('Tag already exists, searching again:', suggestedTag)

                  // Reload tags to get the latest list including the conflicting tag
                  const tagsResponse = await fetch('/api/admin/tags?page=0&pageSize=1000&search=' + encodeURIComponent(suggestedTag.trim()))
                  if (tagsResponse.ok) {
                    const tagsData = await tagsResponse.json()
                    const foundTag = tagsData.tags?.find((tag: Tag) =>
                      tag.name.toLowerCase().trim() === suggestedTag.toLowerCase().trim()
                    )
                    if (foundTag) {
                      existingTag = foundTag
                      // Add to local tags list if not already there
                      setTags(prev => {
                        const exists = prev.find(t => t.id === foundTag.id)
                        return exists ? prev : [...prev, foundTag]
                      })
                      console.log('Found existing tag after conflict:', foundTag.name)
                    }
                  }
                } else {
                  const errorData = await response.json()
                  console.error('Error creating tag:', errorData)
                }
              } catch (error) {
                console.error('Error creating tag:', error)
              }
            }

            if (existingTag) {
              suggestedTagIds.push(existingTag.id)
            }
          }

          if (suggestedTagIds.length > 0) {
            setSelectedTags(suggestedTagIds)
            console.log('Auto-selected tags:', suggestedTagIds.length)
          }
        }

      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load categories and tags')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [question])

  const addNewTag = () => {
    if (newTagName.trim()) {
      const newTag = {
        id: `new-${Date.now()}`,
        name: newTagName.trim().toLowerCase()
      }
      setTags(prev => [...prev, newTag])
      setSelectedTags(prev => [...prev, newTag.id])
      setNewTagName('')
      toast.success('Tag added successfully')
    }
  }

  // Create new tag
  const createNewTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name')
      return
    }

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTagName.trim() })
      })

      if (response.ok) {
        const result = await response.json()
        const newTag = result.tag

        // Add to tags list
        setTags(prev => [...prev, newTag])

        // Add to selected tags
        setSelectedTags(prev => [...prev, newTag.id])

        // Clear input
        setNewTagName('')

        toast.success(`Tag "${newTag.name}" created and added`)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to create tag')
      }
    } catch (error) {
      console.error('Error creating tag:', error)
      toast.error('Failed to create tag')
    }
  }

  // Convert attached images to the format expected by the API
  const prepareImageAttachments = (): { image_id: string; question_section: string; order_index: number }[] => {
    return attachedImages.map(img => ({
      image_id: img.image_id,
      question_section: img.question_section,
      order_index: img.order_index
    }))
  }

  const validateForm = () => {
    if (!selectedCategory) {
      toast.error('Please select a category')
      return false
    }
    if (!selectedQuestionSet) {
      toast.error('Please select a question set')
      return false
    }
    return true
  }

  const submitQuestion = async () => {
    if (!question || !validateForm()) return

    setIsSubmitting(true)

    try {
      // Prepare image attachments
      const imageAttachments = prepareImageAttachments()

      // Prepare the final question data
      const finalQuestion = {
        ...question,
        category_id: selectedCategory,
        question_set_id: selectedQuestionSet,
        tag_ids: selectedTags,
        question_images: imageAttachments
      }

      // Submit to the API
      const response = await fetch('/api/admin/create-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalQuestion)
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('API Error:', result)
        throw new Error(result.error || 'Failed to create question')
      }

      toast.success('Question created successfully!')
      onQuestionCreated()

    } catch (error) {
      console.error('Error creating question:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create question')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!question) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No question to finalize.</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading categories and tags...
          </div>
        </CardContent>
      </Card>
    )
  }

  const correctAnswer = question.answer_options.find(opt => opt.is_correct)

  return (
    <div className="space-y-6">
      {/* Question Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Question Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium">{question.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{question.stem.substring(0, 200)}...</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Badge variant={question.difficulty === 'easy' ? 'secondary' :
                           question.difficulty === 'medium' ? 'default' : 'destructive'}>
              {question.difficulty?.toUpperCase() || 'MEDIUM'}
            </Badge>
            <Badge variant="outline">
              {question.answer_options.length} options
            </Badge>
            <Badge variant="outline">
              Correct: {correctAnswer ? `Option ${question.answer_options.indexOf(correctAnswer) + 1}` : 'None'}
            </Badge>
            <Badge variant="outline">
              Images: {attachedImages.length} attached
            </Badge>
            <Badge variant="outline">
              Type: Multiple Choice
            </Badge>
            <Badge variant="outline">
              Status: {question.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Category Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Category</Label>
              {selectedCategory && question?.metadata?.source_content && (
                <Badge variant="secondary" className="text-xs">
                  Auto-assigned from PathPrimer
                </Badge>
              )}
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => {
                  // Check if this is a parent category (level 1) that should not be selectable
                  const isParentCategory = category.level === 1 && (
                    category.name === 'Anatomic Pathology' ||
                    category.name === 'Clinical Pathology'
                  )

                  if (isParentCategory) {
                    // Render as non-selectable header
                    return (
                      <div key={category.id} className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 cursor-default">
                        {category.name}
                      </div>
                    )
                  }

                  // Render as selectable item for subcategories
                  return (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span style={{ marginLeft: `${Math.max(0, (category.level - 2)) * 16}px` }}>
                          {category.name}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tag Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Tags</Label>
            <div className="grid grid-cols-2 gap-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={tag.id}
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTags(prev => [...prev, tag.id])
                      } else {
                        setSelectedTags(prev => prev.filter(id => id !== tag.id))
                      }
                    }}
                  />
                  <Label htmlFor={tag.id} className="text-sm">
                    {tag.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Add New Tag</Label>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name..."
                onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
              />
              <Button onClick={createNewTag} disabled={!newTagName.trim()}>
                Add
              </Button>
            </div>
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
            <Label>Select Question Set</Label>
            <Select value={selectedQuestionSet} onValueChange={setSelectedQuestionSet}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a question set..." />
              </SelectTrigger>
              <SelectContent>
                {questionSets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    <div className="flex items-center gap-2">
                      <span>{set.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {set.source_type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>



      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {selectedCategory ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={selectedCategory ? 'text-green-700' : 'text-red-700'}>
                Category selected
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedQuestionSet ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={selectedQuestionSet ? 'text-green-700' : 'text-red-700'}>
                Question set selected
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-700">
                Question structure valid
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button 
          onClick={submitQuestion}
          disabled={!selectedCategory || !selectedQuestionSet || isSubmitting}
          size="lg"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Upload className="mr-2 h-4 w-4" />
          Create Question
        </Button>
      </div>
    </div>
  )
}
