'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import {
  Brain,
  Sparkles,
  Loader2,
  Wand2,
  Tags,
  FolderTree,
  BarChart3,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { FormState } from './multi-step-question-form'

interface AIQuickActionsSidebarProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
  modelName?: string
  categories?: Array<{ id: string; name: string }>
  questionSets?: Array<{ id: string; name: string }>
  tags?: Array<{ id: string; name: string }>
}

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  action: () => Promise<void>
  disabled?: boolean
  requiresContent?: boolean
}

export function AIQuickActionsSidebar({
  formState,
  updateFormState,
  modelName,
  categories = [],
  questionSets = [],
  tags = []
}: AIQuickActionsSidebarProps) {
  const [chatMessage, setChatMessage] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // Check if basic content exists
  const hasBasicContent = formState.title && formState.stem

  // Handle AI refinement (custom request)
  const handleAIRefinement = async () => {
    if (!chatMessage.trim()) {
      toast.error('Please enter a refinement request')
      return
    }

    if (!hasBasicContent) {
      toast.error('Please add question title and stem first')
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
          mode: 'refinement',
          currentQuestion: {
            title: formState.title,
            stem: formState.stem,
            answerOptions: formState.answerOptions,
            teaching_point: formState.teaching_point,
            question_references: formState.question_references
          },
          instructions: chatMessage,
          model: formState.selectedAIModel
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refine question')
      }

      const result = await response.json()

      // Update form with refined content
      updateFormState({
        title: result.title || formState.title,
        stem: result.stem || formState.stem,
        answerOptions: result.answerOptions || formState.answerOptions,
        teaching_point: result.teaching_point || formState.teaching_point,
        question_references: result.question_references || formState.question_references
      })

      toast.success('Question refined successfully!')
      setChatMessage('')
    } catch (error) {
      console.error('Error refining question:', error)
      toast.error('Failed to refine question')
    } finally {
      setIsRefining(false)
    }
  }

  // Auto-suggest category
  const handleAutoCategory = async () => {
    if (!hasBasicContent) {
      toast.error('Please add question title and stem first')
      return
    }

    setActiveAction('category')
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
        throw new Error('Failed to suggest category')
      }

      const result = await response.json()

      if (result.category_id) {
        updateFormState({ category_id: result.category_id })
        const categoryName = categories.find(c => c.id === result.category_id)?.name
        toast.success(`Category set to: ${categoryName}`)
      } else {
        toast.info('No category suggestion available')
      }
    } catch (error) {
      console.error('Error suggesting category:', error)
      toast.error('Failed to suggest category')
    } finally {
      setActiveAction(null)
    }
  }

  // Auto-suggest tags
  const handleSuggestTags = async () => {
    if (!hasBasicContent) {
      toast.error('Please add question title and stem first')
      return
    }

    setActiveAction('tags')
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
        throw new Error('Failed to suggest tags')
      }

      const result = await response.json()

      if (result.suggested_tag_ids && result.suggested_tag_ids.length > 0) {
        updateFormState({ tag_ids: result.suggested_tag_ids })
        toast.success(`${result.suggested_tag_ids.length} tags suggested`)
      } else {
        toast.info('No tag suggestions available')
      }
    } catch (error) {
      console.error('Error suggesting tags:', error)
      toast.error('Failed to suggest tags')
    } finally {
      setActiveAction(null)
    }
  }

  // Auto-suggest difficulty
  const handleSuggestDifficulty = async () => {
    if (!hasBasicContent) {
      toast.error('Please add question title and stem first')
      return
    }

    setActiveAction('difficulty')
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
        throw new Error('Failed to suggest difficulty')
      }

      const result = await response.json()

      if (result.difficulty) {
        updateFormState({ difficulty: result.difficulty })
        toast.success(`Difficulty set to: ${result.difficulty}`)
      } else {
        toast.info('No difficulty suggestion available')
      }
    } catch (error) {
      console.error('Error suggesting difficulty:', error)
      toast.error('Failed to suggest difficulty')
    } finally {
      setActiveAction(null)
    }
  }

  // Auto-suggest all metadata
  const handleSuggestAllMetadata = async () => {
    if (!hasBasicContent) {
      toast.error('Please add question title and stem first')
      return
    }

    setActiveAction('all-metadata')
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

      // Apply all AI suggestions
      const updates: Partial<FormState> = {}
      if (result.category_id) updates.category_id = result.category_id
      if (result.question_set_id) updates.question_set_id = result.question_set_id
      if (result.difficulty) updates.difficulty = result.difficulty
      if (result.suggested_tag_ids && result.suggested_tag_ids.length > 0) {
        updates.tag_ids = result.suggested_tag_ids
      }

      updateFormState(updates)
      toast.success('All metadata suggestions applied!')
    } catch (error) {
      console.error('Error generating metadata suggestions:', error)
      toast.error('Failed to generate metadata suggestions')
    } finally {
      setActiveAction(null)
    }
  }

  const quickActions: QuickAction[] = [
    {
      id: 'category',
      label: 'Auto Category',
      icon: <FolderTree className="h-4 w-4" />,
      description: 'Suggest category',
      action: handleAutoCategory,
      requiresContent: true
    },
    {
      id: 'tags',
      label: 'Suggest Tags',
      icon: <Tags className="h-4 w-4" />,
      description: 'Add relevant tags',
      action: handleSuggestTags,
      requiresContent: true
    },
    {
      id: 'difficulty',
      label: 'Auto Difficulty',
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'Assess difficulty',
      action: handleSuggestDifficulty,
      requiresContent: true
    },
    {
      id: 'all-metadata',
      label: 'All Metadata',
      icon: <Zap className="h-4 w-4" />,
      description: 'Suggest everything',
      action: handleSuggestAllMetadata,
      requiresContent: true
    }
  ]

  return (
    <Card className="sticky top-6 shadow-sm">
      <CardHeader className="pb-4 space-y-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          AI Assistant
        </CardTitle>
        <CardDescription className="text-sm">
          Quick actions and custom refinements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Model Info */}
        {modelName && (
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex items-center gap-2 border border-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Using: {modelName}</span>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Quick Actions
          </Label>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((action) => {
              const isLoading = activeAction === action.id
              const isDisabled = (action.requiresContent && !hasBasicContent) || isLoading || activeAction !== null

              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={action.action}
                  disabled={isDisabled}
                  className="h-auto flex-col items-start p-3 gap-1.5 hover:bg-primary/5 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center gap-2 w-full">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="text-primary">{action.icon}</div>
                    )}
                    <span className="text-xs font-semibold">{action.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-normal leading-tight">
                    {action.description}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Custom Refinement */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Custom Request
          </Label>
          <Textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="e.g., 'Make the stem more concise' or 'Add more clinical context'"
            rows={4}
            className="resize-none text-sm"
            disabled={!hasBasicContent}
          />
          <Button
            onClick={handleAIRefinement}
            disabled={isRefining || !chatMessage.trim() || !hasBasicContent}
            className="w-full"
            size="default"
          >
            {isRefining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Refine Question
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

