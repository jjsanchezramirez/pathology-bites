'use client'

import { QuestionSnapshotPreview } from './question-snapshot-preview'

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

interface VersionSnapshotViewProps {
  version: QuestionVersion
}

// Helper function to transform question data for display
function transformQuestionData(version: QuestionVersion) {
  const questionData = version.question_snapshot
  
  if (!questionData) return null

  // Transform the data structure to match what the preview component expects
  return {
    ...questionData,
    // Ensure question_options is properly structured
    question_options: Array.isArray(questionData.answer_options) 
      ? questionData.answer_options 
      : Array.isArray(questionData.question_options)
      ? questionData.question_options
      : [],
    // Ensure question_images is properly structured
    question_images: Array.isArray(questionData.question_images) 
      ? questionData.question_images 
      : [],
    // Ensure categories is properly structured
    categories: Array.isArray(questionData.categories) 
      ? questionData.categories 
      : []
  }
}

export function VersionSnapshotView({ version }: VersionSnapshotViewProps) {
  const questionData = version.question_snapshot

  if (!questionData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No question data available for this version
      </div>
    )
  }

  // Transform the snapshot data using the helper function
  const transformedQuestion = transformQuestionData(version)

  if (!transformedQuestion) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Unable to load question data for this version
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="bg-muted/50 p-3 rounded text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="font-medium">Version:</span> {version.version_string}</div>
          <div><span className="font-medium">Created:</span> {new Date(version.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</div>
          <div><span className="font-medium">Update Type:</span> {version.update_type.charAt(0).toUpperCase() + version.update_type.slice(1)}</div>
          <div><span className="font-medium">{version.version_string === 'v1.0.0' ? 'Created by' : 'Last updated by'}:</span> {
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
        <QuestionSnapshotPreview key={version.id} question={transformedQuestion} />
      </div>
    </div>
  )
}
