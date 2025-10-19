'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/shared/services/client'
import { Send, Users, Clock, Loader2 } from 'lucide-react'

interface Reviewer {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  pending_count: number
}

interface BulkSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionCount: number
  onConfirm: (reviewerId: string) => void
}

export function BulkSubmitDialog({
  open,
  onOpenChange,
  questionCount,
  onConfirm
}: BulkSubmitDialogProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  // Fetch reviewers when dialog opens
  useEffect(() => {
    const fetchReviewers = async () => {
      if (!open) return

      setLoading(true)
      try {
        const response = await fetch('/api/admin/reviewers')
        if (!response.ok) {
          throw new Error('Failed to fetch reviewers')
        }

        const data = await response.json()
        setReviewers(data.reviewers || [])
      } catch (error) {
        console.error('Error fetching reviewers:', error)
        toast.error('Failed to load reviewers')
      } finally {
        setLoading(false)
      }
    }

    fetchReviewers()
  }, [open])

  const handleSubmit = async () => {
    if (!selectedReviewerId) {
      toast.error('Please select a reviewer')
      return
    }

    setSubmitting(true)
    try {
      onConfirm(selectedReviewerId)
      onOpenChange(false)
      setSelectedReviewerId('')
    } catch (error) {
      console.error('Error in bulk submit:', error)
      toast.error('Failed to submit questions')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    setSelectedReviewerId('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Bulk Submit for Review
          </DialogTitle>
          <DialogDescription>
            Submit {questionCount} question{questionCount !== 1 ? 's' : ''} for review. 
            All selected questions will be assigned to the same reviewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Count Summary */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Badge variant="secondary" className="text-sm">
              {questionCount} Question{questionCount !== 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-muted-foreground">
              will be submitted for review
            </span>
          </div>

          {/* Reviewer Selection */}
          <div className="space-y-2">
            <Label htmlFor="reviewer">Assign to Reviewer</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((reviewer) => (
                    <SelectItem key={reviewer.id} value={reviewer.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {reviewer.first_name} {reviewer.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {reviewer.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="outline" className="text-xs">
                            {reviewer.role}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {reviewer.pending_count}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reviewers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Numbers show current pending review count for each reviewer.
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Bulk Assignment
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  All {questionCount} questions will be assigned to the selected reviewer. 
                  They will receive notifications for each question.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedReviewerId || loading}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Submit {questionCount} Question{questionCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
