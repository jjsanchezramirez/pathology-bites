'use client'

import { Card } from '@/shared/components/ui/card'
import { Microscope } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

export default function WSIQuestionsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Digital Slides Questions"
        description="Practice with AI-generated questions based on real virtual slide images and educational content."
        icon={Microscope}
      />

      {/* Main Content */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Tool Has Moved</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  The Digital Slides Questions tool is now available exclusively to registered users
                  as part of our authenticated learning platform.
                </p>
                <p>
                  Creating a free account gives you access to this tool along with all our interactive
                  learning features, progress tracking, and personalized study recommendations.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Spacer to push sections to bottom */}
      <div className="flex-1" />

      {/* Join Community Section */}
      <JoinCommunitySection />
    </div>
  )
}

