// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top"
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import DemoQuestion from "@/shared/components/common/demo-question"
import ComingSoonPage from "./coming-soon/page"
import MaintenancePage from "./maintenance/page"
import { PublicStatsSection } from "@/shared/components/common/public-stats-section"
import { WhyChoosePathologyBites } from "@/shared/components/common/why-choose-pathology-bites"
import { InteractiveLearningTools } from "@/shared/components/common/interactive-learning-tools"
import { VirtualSlideSearchEngine } from "@/shared/components/common/virtual-slide-search-engine"

export default function LandingPage() {
  const [bypassEnabled, setBypassEnabled] = useState(false)

  // Check if maintenance mode is enabled (takes priority over coming soon)
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  const scrollToNext = () => {
    const nextSection = document.getElementById('learn-more-section')
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Check for bypass on mount (dev mode only)
  useEffect(() => {
    // Check URL parameter for dev bypass only
    const urlParams = new URLSearchParams(window.location.search)
    const bypassParam = urlParams.get('bypass')

    if (process.env.NODE_ENV !== 'production' && bypassParam === 'true') {
      setBypassEnabled(true)
    }
  }, [])

  // If maintenance mode is enabled and no bypass, show the maintenance page (highest priority)
  if (isMaintenanceMode && !bypassEnabled) {
    return <MaintenancePage />
  }

  // If coming soon mode is enabled and no bypass, show the coming soon page
  if (isComingSoonMode && !bypassEnabled) {
    return <ComingSoonPage />
  }
  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden">
        {/* Enhanced Background Gradients */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
        
        {/* Content Container */}
        <div className="container px-4 sm:px-6 lg:px-8 relative flex justify-center">
          <div className="relative max-w-5xl space-y-8 text-center">
            {/* Main Headline */}
            <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
              Welcome to{" "}
              <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Pathology Bites
              </span>
            </h1>

            {/* Supporting Content */}
            <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.5s' }}>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                Master pathology with bite-sized, interactive learning designed by residents for residents
              </p>
            </div>

            {/* CTA Buttons with improved copy */}
            <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.9s' }}>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 px-8
                      transform hover:scale-105 active:scale-95
                      hover:shadow-xl hover:shadow-primary/20
                      transition-all duration-300 ease-in-out"
                  >
                    Start Learning Free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 hover:bg-primary/5 hover:border-primary/50
                      transform hover:scale-105 active:scale-95
                      transition-all duration-300 ease-in-out"
                  >
                    I Have an Account
                  </Button>
                </Link>
              </div>

              {/* Trust indicator */}
              <p className="text-sm text-muted-foreground">
                Join thousands of medical students and residents • 100% Free • No credit card required
              </p>
            </div>
          </div>
        </div>

        {/* Learn More Button - Positioned at bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <button
            onClick={scrollToNext}
            className="group flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300"
            aria-label="Learn more about Pathology Bites"
          >
            <span className="text-sm font-medium">Learn more about Pathology Bites</span>
            <ChevronDown className="h-5 w-5 animate-bounce group-hover:animate-pulse" />
          </button>
        </div>
      </section>

      {/* Why Choose Pathology Bites Section */}
      <WhyChoosePathologyBites id="learn-more-section" />



      {/* Interactive Tools Section */}
      <InteractiveLearningTools />


      {/* Virtual Slide Search Engine Section */}
      <VirtualSlideSearchEngine />

      {/* Demo Question Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Preview Our Interactive Learning
            </h2>
            <p className="text-xl text-muted-foreground">
              Experience our interactive learning format with this sample question
            </p>
          </div>
          <DemoQuestion />
        </div>
      </section>

      {/* Stats Section */}
      <PublicStatsSection variant="landing" className="bg-muted/30" />

      {/* Final CTA Section */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-tr from-primary-foreground/10 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            {/* Closing Statement */}
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-white sm:text-5xl">
                Your Pathology Mastery Starts Here
              </h2>
              <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
                Start learning pathology the smarter way.
                <strong className="text-white"> 100% free. No credit card. No catch.</strong>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold
                    transform hover:scale-105 active:scale-95
                    hover:shadow-xl hover:shadow-white/10
                    transition-all duration-300 ease-in-out
                    relative overflow-hidden w-48"
                >
                  Get Free Account
                </Button>
              </Link>

              <Link href="https://discord.gg/2v64p2fzsC" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 text-lg font-semibold
                    transform hover:scale-105 active:scale-95
                    hover:shadow-xl hover:shadow-[#5865F2]/25
                    transition-all duration-300 ease-in-out
                    flex items-center gap-3 w-48"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join Community
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll To Top Button */}
      <ScrollToTopButton />
    </>
  )
}