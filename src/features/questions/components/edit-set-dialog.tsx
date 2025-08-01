// src/components/question-management/edit-set-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BlurredDialog } from '@/shared/components/ui/blurred-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface QuestionSet {
  id: string
  name: string
  description?: string
  source_type: string
  is_active: boolean
  created_at: string
  question_count?: number
  created_by_name?: string
}

interface EditSetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  questionSet: QuestionSet | null
}

const sourceTypes = [
  { value: 'AI-Generated', label: 'AI-Generated' },
  { value: 'Web Resource', label: 'Web Resource' },
  { value: 'Textbook', label: 'Textbook' },
  { value: 'Expert-Authored', label: 'Expert-Authored' },
  { value: 'User-Generated', label: 'User-Generated' },
  { value: 'Other', label: 'Other' }
]

// Source details options based on source type
const sourceDetailsOptions = {
  'AI-Generated': [
    // Gemini models
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-pro', label: 'Gemini Pro' },

    // Mistral models (latest versions)
    { value: 'mistral-large-2411', label: 'Mistral Large 2.1' },
    { value: 'mistral-medium-2505', label: 'Mistral Medium 3' },
    { value: 'magistral-medium-2507', label: 'Magistral Medium 1.1' },
    { value: 'mistral-small-2407', label: 'Mistral Small 2' },
    { value: 'ministral-8b-2410', label: 'Ministral 8B' },
    { value: 'ministral-3b-2410', label: 'Ministral 3B' },

    // DeepSeek models
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder' },

    // Claude models
    { value: 'claude-4-sonnet', label: 'Claude 4 Sonnet' },
    { value: 'claude-4-opus', label: 'Claude 4 Opus' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },

    // ChatGPT models
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },

    // Other options
    { value: 'multiple-models', label: 'Multiple AI Models' },
    { value: 'other-ai', label: 'Other AI Model' }
  ],
  'Web Resource': [
    { value: 'pathologyoutlines.com', label: 'PathologyOutlines.com' },
    { value: 'webpathology.com', label: 'WebPathology.com' },
    { value: 'pathpedia.com', label: 'Pathpedia.com' },
    { value: 'cap.org', label: 'CAP.org' },
    { value: 'ascp.org', label: 'ASCP.org' },
    { value: 'other-website', label: 'Other Website' }
  ],
  'Textbook': [
    { value: 'robbins-pathology', label: 'Robbins & Cotran Pathologic Basis of Disease' },
    { value: 'rosai-ackerman', label: 'Rosai and Ackerman\'s Surgical Pathology' },
    { value: 'sternberg-diagnostic', label: 'Sternberg\'s Diagnostic Surgical Pathology' },
    { value: 'mills-histology', label: 'Mills\' Histology for Pathologists' },
    { value: 'other-textbook', label: 'Other Textbook' }
  ],
  'Expert-Authored': [
    { value: 'pathologist-created', label: 'Created by Pathologist' },
    { value: 'resident-created', label: 'Created by Resident' },
    { value: 'faculty-reviewed', label: 'Faculty Reviewed' },
    { value: 'peer-reviewed', label: 'Peer Reviewed' },
    { value: 'other-expert', label: 'Other Expert Source' }
  ],
  'User-Generated': [
    { value: 'community-contributed', label: 'Community Contributed' },
    { value: 'student-created', label: 'Student Created' },
    { value: 'crowdsourced', label: 'Crowdsourced' },
    { value: 'other-user', label: 'Other User Source' }
  ],
  'Other': [
    { value: 'conference-material', label: 'Conference Material' },
    { value: 'journal-article', label: 'Journal Article' },
    { value: 'case-study', label: 'Case Study' },
    { value: 'other-source', label: 'Other Source' }
  ]
}

export function EditSetDialog({ open, onOpenChange, onSuccess, questionSet }: EditSetDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [sourceDetails, setSourceDetails] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Update form when questionSet changes
  useEffect(() => {
    if (questionSet && open) {
      setName(questionSet.name)
      setDescription(questionSet.description || '')
      setSourceType(questionSet.source_type)
      setSourceDetails('') // Initialize empty, will be populated from source_details JSON
      setIsActive(questionSet.is_active)
    }
  }, [questionSet, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Question set name is required')
      return
    }

    if (!sourceType) {
      toast.error('Source type is required')
      return
    }

    if (!questionSet) {
      toast.error('No question set selected for editing')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          setId: questionSet.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            source_type: sourceType,
            is_active: isActive
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update question set')
      }

      toast.success('Question set updated successfully')

      // Close dialog first, then refresh data
      onOpenChange(false)
      setTimeout(() => {
        onSuccess()
      }, 100)
    } catch (error) {
      console.error('Error updating question set:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update question set')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen)
      // Note: State cleanup removed to prevent conflicts with Select dropdown portals
      // State will be reset when dialog opens again via useEffect
    }
  }

  return (
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Question Set"
      description="Update the question set details. This will affect how questions are organized and categorized."
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !name.trim() || !sourceType}
            onClick={handleSubmit}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Question Set'
            )}
          </Button>
        </>
      }
    >
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Question Set Name</Label>
            <Input
              id="name"
              placeholder="Enter question set name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter question set description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUpdating}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceType">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType} disabled={isUpdating}>
              <SelectTrigger>
                <SelectValue placeholder="Select source type..." />
              </SelectTrigger>
              <SelectContent>
                {sourceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceType && sourceDetailsOptions[sourceType as keyof typeof sourceDetailsOptions] && (
            <div className="space-y-2">
              <Label htmlFor="sourceDetails">Source Details</Label>
              <Select value={sourceDetails} onValueChange={setSourceDetails} disabled={isUpdating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select specific source..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceDetailsOptions[sourceType as keyof typeof sourceDetailsOptions].map((detail) => (
                    <SelectItem key={detail.value} value={detail.value}>
                      {detail.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isUpdating}
            />
            <Label htmlFor="isActive">Active</Label>
            <span className="text-sm text-muted-foreground">
              (Active question sets can be used for new questions)
            </span>
          </div>

        </form>
    </BlurredDialog>
  )
}
