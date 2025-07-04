'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { Loader2, History, User, Calendar, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { QuestionVersionHistory as QuestionVersionHistoryType, UpdateType } from '@/features/questions/types/questions'

interface QuestionVersionHistoryProps {
  questionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Update type configuration for UI
const UPDATE_TYPE_CONFIG: Record<UpdateType, { label: string; color: string; description: string }> = {
  patch: {
    label: 'Patch',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    description: 'Typos, formatting, references'
  },
  minor: {
    label: 'Minor',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    description: 'Content changes, options, explanations'
  },
  major: {
    label: 'Major',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    description: 'Complete rewrite or restructure'
  }
}

export function QuestionVersionHistory({ questionId, open, onOpenChange }: QuestionVersionHistoryProps) {
  const [versions, setVersions] = useState<QuestionVersionHistoryType[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<QuestionVersionHistoryType | null>(null)

  useEffect(() => {
    if (open && questionId) {
      fetchVersionHistory()
    }
  }, [open, questionId])

  const fetchVersionHistory = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/admin/questions/${questionId}/version`)
      if (!response.ok) {
        throw new Error('Failed to fetch version history')
      }

      const data = await response.json()
      setVersions(data.versions || [])
    } catch (error) {
      console.error('Error fetching version history:', error)
      toast.error('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getChangerName = (changer: any) => {
    if (!changer) return 'Unknown'
    return `${changer.first_name} ${changer.last_name}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Question Version History
          </DialogTitle>
          <DialogDescription>
            View the complete version history and changes made to this question.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 h-[70vh]">
          {/* Version List */}
          <div className="w-1/2 border-r pr-4">
            <h3 className="text-sm font-medium mb-3">Versions</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No version history available
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-full">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">v{version.version_string}</span>
                      <Badge className={UPDATE_TYPE_CONFIG[version.update_type].color}>
                        {UPDATE_TYPE_CONFIG[version.update_type].label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getChangerName(version.changer)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(version.created_at)}
                      </div>
                      {version.change_summary && (
                        <div className="flex items-start gap-1">
                          <FileText className="h-3 w-3 mt-0.5" />
                          <span className="line-clamp-2">{version.change_summary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version Details */}
          <div className="w-1/2 pl-4">
            <h3 className="text-sm font-medium mb-3">Version Details</h3>
            {selectedVersion ? (
              <div className="space-y-4 overflow-y-auto max-h-full">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Version:</span> v{selectedVersion.version_string}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span>{' '}
                    <Badge className={UPDATE_TYPE_CONFIG[selectedVersion.update_type].color}>
                      {UPDATE_TYPE_CONFIG[selectedVersion.update_type].label}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Changed by:</span> {getChangerName(selectedVersion.changer)}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {formatDate(selectedVersion.created_at)}
                  </div>
                </div>

                {selectedVersion.change_summary && (
                  <div>
                    <span className="font-medium text-sm">Change Summary:</span>
                    <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                      {selectedVersion.change_summary}
                    </p>
                  </div>
                )}

                <div>
                  <span className="font-medium text-sm">Update Type Description:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {UPDATE_TYPE_CONFIG[selectedVersion.update_type].description}
                  </p>
                </div>

                {/* Question Data Preview */}
                <div>
                  <span className="font-medium text-sm">Question Data Snapshot:</span>
                  <div className="mt-2 p-3 bg-muted/50 rounded text-xs font-mono max-h-64 overflow-y-auto">
                    <pre>{JSON.stringify(selectedVersion.question_data, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a version to view details
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
