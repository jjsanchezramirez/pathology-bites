// src/features/debug/components/anki-media-delete-dialog.tsx

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2 
} from 'lucide-react'
import { toast } from 'sonner'

interface AnkiMediaDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DeleteProgress {
  phase: 'idle' | 'listing' | 'deleting' | 'complete' | 'error'
  processed: number
  total: number
  deletedFiles: number
  errors: string[]
}

export function AnkiMediaDeleteDialog({ open, onOpenChange }: AnkiMediaDeleteDialogProps) {
  const [progress, setProgress] = useState<DeleteProgress>({
    phase: 'idle',
    processed: 0,
    total: 0,
    deletedFiles: 0,
    errors: []
  })
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    setProgress({
      phase: 'listing',
      processed: 0,
      total: 0,
      deletedFiles: 0,
      errors: []
    })

    try {
      toast.loading('Starting bulk deletion of Anki media files...', { id: 'anki-delete' })

      const response = await fetch('/api/r2/anki-media/delete-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete files')
      }

      const result = await response.json()

      setProgress({
        phase: result.success ? 'complete' : 'error',
        processed: result.deletedFiles,
        total: result.totalFiles,
        deletedFiles: result.deletedFiles,
        errors: result.errors || []
      })

      if (result.success) {
        toast.success(
          `Successfully deleted ${result.deletedFiles} of ${result.totalFiles} Anki media files`,
          { id: 'anki-delete' }
        )
      } else {
        toast.error(
          `Deletion completed with errors. ${result.deletedFiles} files deleted, ${result.errors.length} errors.`,
          { id: 'anki-delete' }
        )
      }

    } catch (error) {
      console.error('Delete all error:', error)
      setProgress(prev => ({
        ...prev,
        phase: 'error',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      }))
      toast.error('Failed to delete Anki media files', { id: 'anki-delete' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
      setProgress({
        phase: 'idle',
        processed: 0,
        total: 0,
        deletedFiles: 0,
        errors: []
      })
      onOpenChange(false)
    }
  }

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0
    return Math.round((progress.processed / progress.total) * 100)
  }

  const getPhaseDescription = () => {
    switch (progress.phase) {
      case 'listing':
        return 'Scanning Anki media files...'
      case 'deleting':
        return `Deleting files... (${progress.processed}/${progress.total})`
      case 'complete':
        return `Deletion complete! ${progress.deletedFiles} files deleted.`
      case 'error':
        return 'Deletion failed with errors.'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <span>Delete All Anki Media Files</span>
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete all files in the Anki Media bucket (pathology-bites-anki).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {progress.phase === 'idle' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will permanently delete all Anki flashcard media files. 
                This action cannot be undone. Make sure you have backups if needed.
              </AlertDescription>
            </Alert>
          )}

          {(progress.phase === 'listing' || progress.phase === 'deleting') && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{getPhaseDescription()}</span>
              </div>
              {progress.total > 0 && (
                <div className="space-y-2">
                  <Progress value={getProgressPercentage()} className="w-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {progress.processed} of {progress.total} files processed ({getProgressPercentage()}%)
                  </p>
                </div>
              )}
            </div>
          )}

          {progress.phase === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Success!</strong> {getPhaseDescription()}
                {progress.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-amber-600">
                      Note: {progress.errors.length} files could not be deleted.
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {progress.phase === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Error:</strong> {getPhaseDescription()}
                {progress.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    <p className="text-sm">Errors encountered:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      {progress.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="truncate">• {error}</li>
                      ))}
                      {progress.errors.length > 5 && (
                        <li className="text-muted-foreground">
                          ... and {progress.errors.length - 5} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {progress.phase === 'complete' || progress.phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
          {progress.phase === 'idle' && (
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Files
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
