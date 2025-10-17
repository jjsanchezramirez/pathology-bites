'use client'

import { WSIQuestionGenerator } from '@/shared/components/features/wsi-question-generator'

// Note: Metadata would be exported from a parent layout or server component
// This is a client component so metadata is handled by the layout

export default function WSIQuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Digital Slides</h1>
        <p className="text-muted-foreground">
          Generate unlimited AI-powered pathology questions from whole slide images.
        </p>
      </div>

      {/* WSI Question Generator Component */}
      <WSIQuestionGenerator
        showCategoryFilter={true}
        compact={false}
        className="w-full"
      />
    </div>
  )
}
