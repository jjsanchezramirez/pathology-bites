'use client'

import { Microscope, ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { WSIQuestionGenerator } from '@/shared/components/features/wsi-question-generator'

// Note: Metadata would be exported from a parent layout or server component
// This is a client component so metadata is handled by the layout

export default function WSIQuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Microscope className="h-6 w-6 text-primary" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Slide Detective</h1>
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta
            </Badge>
          </div>
        </div>
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
