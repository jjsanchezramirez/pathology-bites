'use client'

import { useState, useEffect } from 'react'
import { Brain, Microscope, Database } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { ContentDisclaimer } from '@/shared/components/common/content-disclaimer'
import { WSIQuestionGenerator } from '@/shared/components/features/wsi-question-generator'
import { ScrollToTopButton } from '@/shared/components/common/scroll-to-top'

interface WSIStats {
  totalSlides: number
  totalRepositories: number
  repositories: string[]
  categories: string[]
  totalCategories: number
}

export default function WSIQuestionGeneratorPage() {
  const [wsiStats, setWsiStats] = useState<WSIStats | null>(null)

  useEffect(() => {
    // Fetch WSI statistics
    fetch('/api/tools/wsi-question-generator/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWsiStats(data.stats)
        }
      })
      .catch(err => console.error('Failed to fetch WSI stats:', err))
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="WSI Questions"
        description="Generate AI-powered pathology questions using whole slide images from multiple educational repositories. Practice with real cases and get instant feedback with detailed explanations to enhance your diagnostic skills."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>AI Powered</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>{wsiStats ? `${wsiStats.totalSlides.toLocaleString()} WSI Slides` : 'Loading...'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Microscope className="h-4 w-4" />
              <span>{wsiStats ? `${wsiStats.totalRepositories} Repositories` : 'Loading...'}</span>
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

      {/* Scroll to Top Button - Mobile Only */}
      <div className="block md:hidden">
        <ScrollToTopButton />
      </div>
    </div>
  )
}
