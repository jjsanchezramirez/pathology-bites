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

interface VersionComparisonViewProps {
  currentVersion: QuestionVersion
  previousVersion: QuestionVersion
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
    })
  }

  // Compare images
  const oldImages = oldData.question_images || []
  const newImages = newData.question_images || []

  if (oldImages.length !== newImages.length) {
    changes.push(`Number of images changed (${oldImages.length} → ${newImages.length})`)
  }

  return changes
}

export function VersionComparisonView({
  currentVersion,
  previousVersion
}: VersionComparisonViewProps) {
  const changes = getChanges(previousVersion.question_snapshot, currentVersion.question_snapshot)

  return (
    <div className="space-y-6">
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
              key={`prev-${previousVersion.id}`}
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
              key={`curr-${currentVersion.id}`}
              question={transformQuestionData(currentVersion)}
              isComparison={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
