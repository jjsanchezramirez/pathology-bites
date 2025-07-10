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
import { Check } from "lucide-react"

// Utility function to compare two objects and find differences
function getChanges(oldData: any, newData: any): string[] {
  const changes: string[] = []

  if (!oldData || !newData) return changes

  // Compare basic fields
  const fieldsToCompare = ['title', 'stem', 'difficulty', 'teaching_point', 'question_references']

  fieldsToCompare.forEach(field => {
    if (oldData[field] !== newData[field]) {
      changes.push(`${field.replace('_', ' ')} changed`)
    }
  })

  // Compare answer options
  const oldOptions = oldData.answer_options || []
  const newOptions = newData.answer_options || []

  if (oldOptions.length !== newOptions.length) {
    changes.push(`Number of answer options changed (${oldOptions.length} → ${newOptions.length})`)
  } else {
    oldOptions.forEach((oldOption: any, index: number) => {
      const newOption = newOptions[index]
      if (oldOption?.text !== newOption?.text) {
        changes.push(`Answer option ${index + 1} text changed`)
      }
      if (oldOption?.is_correct !== newOption?.is_correct) {
        changes.push(`Answer option ${index + 1} correctness changed`)
      }
      if (oldOption?.explanation !== newOption?.explanation) {
        changes.push(`Answer option ${index + 1} explanation changed`)
      }
    })
  }

  // Compare images
  const oldImages = oldData.question_images || []
  const newImages = newData.question_images || []

  if (oldImages.length !== newImages.length) {
    changes.push(`Number of images changed (${oldImages.length} → ${newImages.length})`)
  }

  // Compare tags
  const oldTags = oldData.tag_ids || []
  const newTags = newData.tag_ids || []

  if (oldTags.length !== newTags.length) {
    changes.push(`Number of tags changed (${oldTags.length} → ${newTags.length})`)
  } else if (JSON.stringify(oldTags.sort()) !== JSON.stringify(newTags.sort())) {
    changes.push('Tags changed')
  }

  return changes
}

// Component to display a version snapshot
function VersionSnapshotView({ version }: { version: QuestionVersion }) {
  const questionData = version.question_snapshot

  if (!questionData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No question data available for this version
      </div>
    )
  }

  // Transform the snapshot data to match QuestionWithDetails format
  const transformedQuestion = {
    id: version.question_id,
    title: questionData.title || 'Untitled Question',
    stem: questionData.stem || '',
    difficulty: questionData.difficulty || 'Medium',
    teaching_point: questionData.teaching_point || '',
    question_references: questionData.question_references || '',
    status: 'published',
    created_at: version.created_at,
    question_options: questionData.answer_options || [],
    question_images: questionData.question_images || [],
    categories: questionData.categories || [],
    tags: questionData.tags || []
  }

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="bg-muted/50 p-3 rounded text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="font-medium">Version:</span> {version.version_string}</div>
          <div><span className="font-medium">Created:</span> {new Date(version.created_at).toLocaleString()}</div>
          <div><span className="font-medium">Update Type:</span> {version.update_type}</div>
          <div><span className="font-medium">Creator:</span> {
            version.creator ?
              `${version.creator.first_name} ${version.creator.last_name}` :
              'Unknown'
          }</div>
        </div>
        {version.change_summary && (
          <div className="mt-3 pt-3 border-t">
            <span className="font-medium">Change Summary:</span> {version.change_summary}
          </div>
        )}
      </div>

      {/* Question Preview */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-4">Question Preview</h3>
        <QuestionSnapshotPreview question={transformedQuestion} />
      </div>
    </div>
  )
}

// Component to display version comparison
function VersionComparisonView({
  currentVersion,
  previousVersion
}: {
  currentVersion: QuestionVersion
  previousVersion: QuestionVersion
}) {
  const changes = getChanges(previousVersion.question_snapshot, currentVersion.question_snapshot)

  return (
    <div className="space-y-6">
      {/* Comparison Header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 p-3 rounded">
          <h3 className="font-medium text-red-800 mb-2">Previous Version ({previousVersion.version_string})</h3>
          <div className="text-sm text-red-700">
            <div>Created: {new Date(previousVersion.created_at).toLocaleString()}</div>
            <div>By: {previousVersion.creator ? `${previousVersion.creator.first_name} ${previousVersion.creator.last_name}` : 'Unknown'}</div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 p-3 rounded">
          <h3 className="font-medium text-green-800 mb-2">Current Version ({currentVersion.version_string})</h3>
          <div className="text-sm text-green-700">
            <div>Created: {new Date(currentVersion.created_at).toLocaleString()}</div>
            <div>By: {currentVersion.creator ? `${currentVersion.creator.first_name} ${currentVersion.creator.last_name}` : 'Unknown'}</div>
          </div>
        </div>
      </div>

      {/* Changes Summary */}
      {changes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded">
          <h3 className="font-medium text-blue-800 mb-3">Changes Made</h3>
          <ul className="space-y-2">
            {changes.map((change, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-blue-700">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg">
          <div className="bg-red-50 border-b border-red-200 p-3">
            <h4 className="font-medium text-red-800">Previous Version</h4>
          </div>
          <div className="p-4">
            <QuestionSnapshotPreview
              question={transformQuestionData(previousVersion)}
              isComparison={true}
            />
          </div>
        </div>
        <div className="border rounded-lg">
          <div className="bg-green-50 border-b border-green-200 p-3">
            <h4 className="font-medium text-green-800">Current Version</h4>
          </div>
          <div className="p-4">
            <QuestionSnapshotPreview
              question={transformQuestionData(currentVersion)}
              isComparison={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to transform version data to question format
function transformQuestionData(version: QuestionVersion) {
  const questionData = version.question_snapshot

  return {
    id: version.question_id,
    title: questionData?.title || 'Untitled Question',
    stem: questionData?.stem || '',
    difficulty: questionData?.difficulty || 'Medium',
    teaching_point: questionData?.teaching_point || '',
    question_references: questionData?.question_references || '',
    status: 'published',
    created_at: version.created_at,
    question_options: questionData?.answer_options || [],
    question_images: questionData?.question_images || [],
    categories: questionData?.categories || [],
    tags: questionData?.tags || []
  }
}

interface QuestionVersion {
  id: string
  question_id: string
  version_major: number
  version_minor: number
  version_patch: number
  version_string: string
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

// Component to preview question snapshot data
function QuestionSnapshotPreview({
  question,
  isComparison = false
}: {
  question: any
  isComparison?: boolean
}) {
  const optionLabels = ['A', 'B', 'C', 'D', 'E']

  return (
    <div className={`space-y-4 ${isComparison ? 'text-sm' : ''}`}>
      {/* Title */}
      <div>
        <h4 className={`font-medium ${isComparison ? 'text-sm' : 'text-lg'} mb-2`}>
          {question.title}
        </h4>
      </div>

      {/* Question Stem */}
      <div className={`${isComparison ? 'text-xs' : 'text-sm'} text-foreground/90`}>
        {question.stem}
      </div>

      {/* Answer Options */}
      <div className="space-y-2">
        <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'}`}>Answer Options</h5>
        {question.question_options && question.question_options.length > 0 ? (
          question.question_options.map((option: any, index: number) => {
            const optionLabel = optionLabels[index] || (index + 1).toString()
            const isCorrect = option.is_correct

            return (
              <div
                key={option.id || index}
                className={`
                  p-2 rounded-md border ${isComparison ? 'text-xs' : 'text-sm'}
                  ${isCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : 'border-muted'}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className={`
                    flex items-center justify-center w-4 h-4 rounded-full border text-xs
                    ${isCorrect ? 'border-green-500' : 'border-muted-foreground/30'}
                  `}>
                    {optionLabel}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {isCorrect && <Check className="w-3 h-3 text-green-500" />}
                </div>
              </div>
            )
          })
        ) : (
          <div className={`p-3 text-center text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
            No answer options available
          </div>
        )}
      </div>

      {/* Teaching Point */}
      {question.teaching_point && (
        <div className="bg-muted/50 p-3 rounded">
          <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} mb-2`}>Teaching Point</h5>
          <div className={`text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
            {question.teaching_point}
          </div>
        </div>
      )}

      {/* References */}
      {question.question_references && (
        <div className="bg-muted/50 p-3 rounded">
          <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} mb-2`}>References</h5>
          <div className={`text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
            {question.question_references}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className={`flex items-center gap-4 pt-2 border-t ${isComparison ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        <Badge variant="outline" className={isComparison ? 'text-xs' : ''}>
          {question.difficulty}
        </Badge>
        <span>Status: {question.status}</span>
        {question.categories && question.categories.length > 0 && (
          <span>Category: {question.categories[0].name}</span>
        )}
      </div>
    </div>
  )
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

      const response = await fetch(`/api/admin/questions/${questionId}/version`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        toast.error('Failed to load version history')
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

  const handleViewSnapshot = (version: QuestionVersion) => {
    setSelectedVersion(version)
    setSnapshotDialogOpen(true)
  }

  const handleCompareWithPrevious = (currentVersion: QuestionVersion, index: number) => {
    const previousVersion = versions[index + 1]
    setCompareVersions({ current: currentVersion, previous: previousVersion })
    setCompareDialogOpen(true)
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

                            {/* Show changes compared to previous version */}
                            {index < versions.length - 1 && (() => {
                              const previousVersion = versions[index + 1]
                              const changes = getChanges(previousVersion.question_snapshot, version.question_snapshot)

                              return changes.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
                                    <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                                    Changes from v{formatVersionNumber(previousVersion)}
                                  </div>
                                  <ul className="text-xs text-blue-700 space-y-1">
                                    {changes.map((change, changeIndex) => (
                                      <li key={changeIndex} className="flex items-center gap-2">
                                        <div className="h-1 w-1 bg-blue-500 rounded-full"></div>
                                        {change}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )
                            })()}

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
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="w-full !max-w-[min(90vw,1100px)] max-h-[90vh] overflow-y-auto">
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
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
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
