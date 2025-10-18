'use client'

import { WSIQuestionGenerator } from '@/shared/components/features/wsi-question-generator'

// Note: Metadata would be exported from a parent layout or server component
// This is a client component so metadata is handled by the layout

export default function WSIQuestionsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <div className="w-full max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Digital Slides Questions</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Generate unlimited AI-powered pathology questions from whole slide images.
          </p>
        </div>

        {/* WSI Question Generator Component */}
        <WSIQuestionGenerator
          showCategoryFilter={true}
          compact={false}
        />
      </div>
    </div>
  )
}
