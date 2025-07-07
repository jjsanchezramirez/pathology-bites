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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Separator } from "@/shared/components/ui/separator"
import { 
  History, 
  User, 
  Calendar, 
  FileText, 
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/shared/services/client'

interface QuestionVersion {
  id: string
  question_id: string
  version_major: number
  version_minor: number
  version_patch: number
  update_type: 'major' | 'minor' | 'patch'
  change_summary: string
  question_snapshot: any
  created_by: string
  created_at: string
  // Joined data
  creator?: {
    first_name: string
    last_name: string
    email: string
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
  const supabase = createClient()

  useEffect(() => {
    if (open && questionId) {
      fetchVersionHistory()
    }
  }, [open, questionId])

  const fetchVersionHistory = async () => {
    if (!questionId) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('question_versions')
        .select(`
          *,
          creator:users!question_versions_created_by_fkey(first_name, last_name, email)
        `)
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching version history:', error)
        toast.error('Failed to load version history')
        return
      }

      setVersions(data || [])
    } catch (error) {
      console.error('Unexpected error fetching version history:', error)
      toast.error('An unexpected error occurred')
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

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-4xl max-h-[85vh]">
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
                              <Button variant="outline" size="sm">
                                <Eye className="h-3 w-3 mr-1" />
                                View Snapshot
                              </Button>
                              {index > 0 && (
                                <Button variant="outline" size="sm">
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
    </Dialog>
  )
}
