'use client'

import dynamic from 'next/dynamic'
import { Brain, Microscope, FolderOpen } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { ContentDisclaimer } from '@/shared/components/common/content-disclaimer'
import { ScrollToTopButton } from '@/shared/components/common/scroll-to-top'

// Dynamic import for the interactive WSI generator
const WSIQuestionGenerator = dynamic(
  () => import('@/shared/components/features/wsi-question-generator').then(mod => ({ default: mod.WSIQuestionGenerator })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-4xl mx-auto" style={{ minHeight: '600px' }}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 mx-auto bg-muted rounded animate-pulse" />
            <p className="text-sm font-medium">Loading WSI Question Generator...</p>
          </div>
        </div>
      </div>
    )
  }
)

// Static stats - updated quarterly from PathPresenter data
const STATIC_STATS = {
  totalSlides: 875,
  totalCategories: 15
}

export default function WSIQuestionGeneratorPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="WSI Questions"
        description="Generate unlimited AI-powered pathology questions from hundreds of whole slide images. Practice with real cases and get instant feedback with detailed explanations to enhance your diagnostic skills."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>AI Driven</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Microscope className="h-4 w-4" />
              <span>{STATIC_STATS.totalSlides.toLocaleString()} Slides Available</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>{STATIC_STATS.totalCategories} Categories</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section id="wsi-content" className="flex-1 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <WSIQuestionGenerator showCategoryFilter={true} />
        </div>
      </section>

      <ContentDisclaimer />

      <JoinCommunitySection />

      {/* Scroll to Top Button - Mobile Only */}
      <div className="block md:hidden">
        <ScrollToTopButton />
      </div>
    </div>
  )
}
