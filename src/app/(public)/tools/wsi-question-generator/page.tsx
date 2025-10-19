'use client'

import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'
import { Microscope } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

export default function WSIQuestionsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Digital Slides Questions"
        description="Practice with AI-generated questions based on real virtual slide images. This tool is now available exclusively to registered users as part of our authenticated learning platform."
        icon={Microscope}
      />

      {/* Main Content */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto space-y-8">
            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Tool Access</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  To provide you with a better learning experience and personalized features,
                  our Digital Slides Questions tool is now available exclusively to registered users.
                </p>
                <p>
                  Creating an account is completely free and gives you access to all our interactive
                  learning tools, progress tracking, and personalized study features.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">What You'll Get</h2>
              <div className="space-y-4 text-muted-foreground">
                <ul className="list-disc pl-6 space-y-2">
                  <li>AI-generated questions from real virtual slide images</li>
                  <li>Personalized learning recommendations</li>
                  <li>Progress tracking and performance analytics</li>
                  <li>Access to all interactive learning tools</li>
                  <li>100% free with no credit card required</li>
                </ul>
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

