'use client'

import { Card } from '@/shared/components/ui/card'
import { Microscope, House } from 'lucide-react'
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
              <div className="flex items-center justify-center mb-6">
                <House className="h-12 w-12 text-primary" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-center">Digital Slides Questions Has a New Home</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We've moved the Digital Slides Questions tool to our enhanced learning platform 
                  where you can access it alongside all your other study tools.
                </p>
                <p>
                  Creating a free account unlocks this tool plus progress tracking, personalized 
                  recommendations, and our complete suite of interactive learning features.
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

