// src/features/questions/components/question-row.tsx
'use client'

import React, { useState, memo, useCallback } from 'react'
import Image from 'next/image'
import { ImageIcon, PencilIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, Loader2 } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import {
  Question,
  QuestionWithDetails,
  Category,
  DIFFICULTY_CONFIG,
  YIELD_CONFIG
} from '@/features/questions/types/questions'
import { getCategoryDisplayName } from '@/features/questions/utils/display-helpers'
import { EditQuestionDialog } from './edit-question-dialog'
import { createClient } from '@/shared/services/client'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { shouldShowDeleteButton } from '@/features/questions/utils/deletion-helpers'

interface QuestionRowProps {
  question: Question
  categoryPaths: Map<number, Category>
  onDelete: (questionId: string) => void
}

function getCategoryPathString(category: Category, categoryPaths: Map<number, Category>): string {
  const parts: string[] = [category.name]
  let currentId = category.parent_id
  
  while (currentId) {
    const parent = categoryPaths.get(currentId)
    if (parent) {
      parts.unshift(parent.name)
      currentId = parent.parent_id
    } else {
      break
    }
  }
  
  return parts.join(' → ')
}

const QuestionRow = memo(function QuestionRow({ question, categoryPaths, onDelete }: QuestionRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [fullQuestion, setFullQuestion] = useState<QuestionWithDetails | null>(null)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)

  const supabase = createClient()
  const { role } = useUserRole()
  const { user } = useAuthStatus()

  // Check if user can delete this question
  const canDelete = shouldShowDeleteButton(question, role, user?.id || null)

  const handleEdit = useCallback(async () => {
    setIsLoadingQuestion(true)
    try {
      // Fetch the full question details from the API
      const response = await fetch(`/api/admin/questions/${question.id}`)
      if (response.ok) {
        const { question: questionDetails } = await response.json()
        setFullQuestion(questionDetails)
        setShowEditDialog(true)
      } else {
        console.error('Failed to fetch question details')
      }
    } catch (error) {
      console.error('Failed to fetch question details:', error)
    } finally {
      setIsLoadingQuestion(false)
    }
  }, [question.id])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      await onDelete(question.id)
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete, question.id])

  return (
    <>
      {/* Main Row */}
      <tr className={`group hover:bg-muted/50 dark:hover:bg-muted/20 ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      }`}>
        {/* Question Column */}
        <td className="py-2 pl-4 pr-3 text-sm sm:pl-6">
          <div className="flex items-start gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 p-0.5 hover:bg-muted/50 dark:hover:bg-muted/20 rounded"
            >
              {isExpanded ? 
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : 
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            <div className="flex-1">
              <div className="font-medium text-foreground dark:text-gray-100">
                {question.body.length > 60
                  ? `${question.body.substring(0, 60)}...`
                  : question.body
                }
              </div>
            </div>
          </div>
        </td>

        {/* Categories Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {question.categories.slice(0, 2).map((category) => (
              <TooltipProvider key={category.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {getCategoryDisplayName(category)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getCategoryPathString(category, categoryPaths)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {question.categories.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      +{question.categories.length - 2}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {question.categories.slice(2).map(category => (
                        <p key={category.id}>{getCategoryPathString(category, categoryPaths)}</p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </td>

        {/* Images Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          {question.images.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowImages(!showImages)}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
                <span>{question.images.length}</span>
              </button>
              
              {showImages && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowImages(false)} />
                  <div className="absolute z-50 mt-2 w-96 bg-background border border-input shadow-lg rounded-md overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {question.images.map((image) => (
                        <div key={image.id} className="relative aspect-square rounded-md overflow-hidden">
                          <Image
                            src={image.url}
                            alt={image.alt_text}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/60 to-transparent">
                            <p className="text-white text-sm truncate">
                              {image.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </td>

        {/* Difficulty Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium ${DIFFICULTY_CONFIG[question.difficulty].color}`}>
                  {DIFFICULTY_CONFIG[question.difficulty].short}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {question.difficulty}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>

        {/* Yield Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium ${YIELD_CONFIG[question.rank].color}`}>
                  {YIELD_CONFIG[question.rank].short}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {question.rank.replace('_', ' ')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>

        {/* Updated Column */}
        <td className="px-2 py-2 text-xs text-muted-foreground dark:text-gray-300">
          {new Date(question.updated_at).toLocaleDateString()}
        </td>

        {/* Actions Column */}
        <td className="px-2 py-2 text-right text-sm text-muted-foreground dark:text-gray-300">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted/50 dark:hover:bg-muted/20 dark:text-gray-300 dark:hover:text-gray-100"
              onClick={handleEdit}
              disabled={isLoadingQuestion}
            >
              {isLoadingQuestion ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PencilIcon className="h-3 w-3" />
              )}
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Content Row */}
      {isExpanded && (
        <tr className="bg-muted/50 dark:bg-muted/10">
          <td colSpan={7} className="px-6 py-4">
            <div className="text-sm text-foreground dark:text-gray-100">
              <div className="font-medium mb-2">Full Question:</div>
              <p className="mb-4 text-muted-foreground dark:text-gray-300">{question.body}</p>
              <div className="font-medium mb-2">Explanation:</div>
              <p className="mb-2 text-muted-foreground dark:text-gray-300">{question.explanation}</p>
              {question.reference_text && (
                <>
                  <div className="font-medium mb-2">Reference:</div>
                  <p className="text-muted-foreground dark:text-gray-300">{question.reference_text}</p>
                </>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Edit Question Dialog */}
      {showEditDialog && fullQuestion && (
        <EditQuestionDialog
          question={fullQuestion}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={() => {
            setShowEditDialog(false)
            setFullQuestion(null)
            // Note: In a real implementation, you might want to refresh the data
            // or call a callback to notify the parent component
          }}
        />
      )}
    </>
  )
})

export default QuestionRow