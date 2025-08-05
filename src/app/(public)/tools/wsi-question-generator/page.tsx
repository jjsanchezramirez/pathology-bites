'use client'

import { Brain, Microscope } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { ContentDisclaimer } from '@/shared/components/common/content-disclaimer'
import { WSIQuestionGenerator } from '@/shared/components/features/wsi-question-generator'

export default function WSIQuestionGeneratorPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="WSI Question Generator"
        description="AI-generated pathology questions using virtual slide images from embeddable repositories."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>AI Generated</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Microscope className="h-4 w-4" />
              <span>Virtual Slides</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <WSIQuestionGenerator showCategoryFilter={true} />
        </div>
      </section>

      <ContentDisclaimer />

      <JoinCommunitySection />
    </div>
  )
}
