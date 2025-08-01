'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import {
  History,
  User,
  Calendar,
  FileText,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { VersionSnapshotView } from './version-history/version-snapshot-view'
import { VersionComparisonView } from './version-history/version-comparison-view'
import { Badge } from "@/shared/components/ui/badge"
import { useProtectedDialog } from '@/shared/hooks/use-protected-dialog'

// Types
interface QuestionVersion {
  id: string
  question_id: string
  version_major: number
  version_minor: number
  version_patch: number
  version_string: string
  update_type: string
  change_summary?: string
  question_snapshot: any
  created_by: string
  created_at: string
  creator?: {
    first_name: string
    last_name: string
  }
}









interface VersionHistoryDialogProps {
  questionId: string | null
  questionTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionHistoryDialog({
  questionId,
  questionTitle,
  open,
  onOpenChange
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<QuestionVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<QuestionVersion | null>(null)
  const [compareVersions, setCompareVersions] = useState<{ current: QuestionVersion | null, previous: QuestionVersion | null }>({ current: null, previous: null })

  // Use protected dialog hook to prevent immediate closing
  const handleOpenChange = useProtectedDialog(open, onOpenChange)

  useEffect(() => {
    if (open && questionId) {
      fetchVersionHistory()
    }
  }, [open, questionId])

  const fetchVersionHistory = async () => {
    if (!questionId) return

    try {
      setLoading(true)

      const response = await fetch(`/api/admin/questions/${questionId}/version`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        toast.error(`Failed to load version history: ${response.status} ${response.statusText}`)
        return
      }

      const result = await response.json()

      if (result.success && result.versions) {
        // Transform the API response to match our interface
        const transformedVersions = result.versions.map((version: any) => ({
          id: version.id,
          question_id: questionId,
          version_major: version.version_major,
          version_minor: version.version_minor,
          version_patch: version.version_patch,
          version_string: version.version_string,
          update_type: version.update_type,
          change_summary: version.change_summary,
          question_snapshot: version.question_data,
          created_by: version.changed_by,
          created_at: version.created_at,
          creator: version.changer
        }))

        setVersions(transformedVersions)
      } else {
        setVersions([])
      }
    } catch (error) {
      console.error('Error fetching version history:', error)
      toast.error(`Failed to load version history: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleVersionExpansion = (versionId: string) => {
    const newExpanded = new Set(expandedVersions)
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId)
    } else {
      newExpanded.add(versionId)
    }
    setExpandedVersions(newExpanded)
  }

  const getUpdateTypeBadge = (updateType: string) => {
    switch (updateType) {
      case 'major':
        return <Badge variant="destructive">Major</Badge>
      case 'minor':
        return <Badge variant="default">Minor</Badge>
      case 'patch':
        return <Badge variant="secondary">Patch</Badge>
      default:
        return <Badge variant="outline">{updateType}</Badge>
    }
  }

  const formatVersionNumber = (version: QuestionVersion) => {
    return `v${version.version_major}.${version.version_minor}.${version.version_patch}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleViewSnapshot = (version: QuestionVersion) => {
    setSelectedVersion(version)
    setSnapshotDialogOpen(true)
  }

  const handleCompareWithPrevious = (currentVersion: QuestionVersion, index: number) => {
    const previousVersion = versions[index + 1]
    setCompareVersions({ current: currentVersion, previous: previousVersion })
    setCompareDialogOpen(true)
  }



  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              {questionTitle ? `Version history for "${questionTitle}"` : 'Question version history'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  No version history available
                </p>
                <p className="text-xs text-muted-foreground">
                  Version history will appear here when the question is updated.
                </p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <div className="space-y-3">
                  {versions.map((version, index) => (
                    <div key={version.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVersionExpansion(version.id)}
                            className="h-6 w-6 p-0"
                          >
                            {expandedVersions.has(version.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {formatVersionNumber(version)}
                            </span>
                            {getUpdateTypeBadge(version.update_type)}
                            {index === 0 && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Current
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.creator ? 
                              `${version.creator.first_name} ${version.creator.last_name}` : 
                              'Unknown'
                            }
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(version.created_at)}
                          </div>
                        </div>
                      </div>

                      {version.change_summary && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">
                            {version.change_summary}
                          </p>
                        </div>
                      )}

                      {expandedVersions.has(version.id) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="h-4 w-4" />
                              Version Details
                            </div>

                            <div className="bg-muted/50 p-3 rounded text-xs">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium">Version:</span> {formatVersionNumber(version)}
                                </div>
                                <div>
                                  <span className="font-medium">Update Type:</span> {version.update_type}
                                </div>
                                <div>
                                  <span className="font-medium">Created:</span> {formatDate(version.created_at)}
                                </div>
                                <div>
                                  <span className="font-medium">Creator:</span> {
                                    version.creator ?
                                      `${version.creator.first_name} ${version.creator.last_name}` :
                                      'Unknown'
                                  }
                                </div>
                              </div>

                              {version.change_summary && (
                                <div className="mt-3 pt-3 border-t border-muted">
                                  <div className="font-medium mb-1">Change Summary:</div>
                                  <div>{version.change_summary}</div>
                                </div>
                              )}
                            </div>



                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewSnapshot(version)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Snapshot
                              </Button>
                              {index < versions.length - 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCompareWithPrevious(version, index)}
                                >
                                  Compare with Previous
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </DialogPortal>

      {/* Version Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen} modal={false}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="w-full !max-w-[min(95vw,1400px)] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Version Snapshot - {selectedVersion ? formatVersionNumber(selectedVersion) : ''}
              </DialogTitle>
              <DialogDescription>
                View the complete question as it appeared in this version
              </DialogDescription>
            </DialogHeader>

            {selectedVersion && (
              <VersionSnapshotView version={selectedVersion} />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen} modal={false}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="w-full !max-w-[min(95vw,1400px)] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Version Comparison
              </DialogTitle>
              <DialogDescription>
                Compare changes between {compareVersions.previous ? formatVersionNumber(compareVersions.previous) : ''} and {compareVersions.current ? formatVersionNumber(compareVersions.current) : ''}
              </DialogDescription>
            </DialogHeader>

            {compareVersions.current && compareVersions.previous && (
              <VersionComparisonView
                currentVersion={compareVersions.current}
                previousVersion={compareVersions.previous}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </Dialog>
  )
}
