// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top"
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, BookOpen, Users, Target, Heart, Zap, GitBranch } from "lucide-react"
import DemoQuestion from "@/shared/components/common/demo-question"
import ComingSoonPage from "./coming-soon/page"
import { usePublicStats } from "@/shared/hooks/use-public-stats"

export default function LandingPage() {
  const [bypassEnabled, setBypassEnabled] = useState(false)
  const { stats, loading: statsLoading } = usePublicStats()

  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  const scrollToNext = () => {
    const nextSection = document.getElementById('learn-more-section')
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Check for bypass on mount
  useEffect(() => {
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    const bypassParam = urlParams.get('bypass')

    // Check localStorage for persistent bypass
    const storedBypass = localStorage.getItem('pathology-bites-bypass')

    if (bypassParam === 'true' || storedBypass === 'true') {
      setBypassEnabled(true)
      // Store bypass in localStorage for future visits
      localStorage.setItem('pathology-bites-bypass', 'true')
    }
  }, [])

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
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
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
      <section id="learn-more-section" className="relative py-24 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              {/* Left Column - Title and Description */}
              <div className="space-y-6">
                <h2 className="text-4xl font-bold">
                  Why choose{" "}
                  <span className="text-primary underline decoration-primary/30">Pathology Bites?</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Built by pathology residents who understand the real challenges of board preparation.
                  Every feature is designed to help you learn more efficiently and retain information better.
                </p>
              </div>

              {/* Right Column - Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">ABPath Aligned</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Every question maps to official pathology board content specifications, ensuring focused study.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">Resident Created</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Made by residents who recently took boards, with input from those who know what actually matters.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">High-Yield Focus</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Essential concepts and board-relevant topics, not obscure facts that won't help you succeed.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">Completely Free</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Open educational resource with no hidden costs, subscriptions, or premium tiers.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">Interactive Learning</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Bite-sized questions with instant feedback and detailed explanations for better retention.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">Community Driven</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Open source project where residents and faculty contribute questions, images, and improvements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Interactive Tools Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Interactive Learning Tools
            </h2>
            <p className="text-xl text-muted-foreground">
              Practice with our specialized tools designed to enhance your diagnostic skills
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Interactive ABPath Content Specifications</h3>
                <p className="text-muted-foreground">Board-aligned learning</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Filter by section, category, and designation – Core, Advance Resident, Fellow
              </p>
              <Link href="/tools/abpath">
                <Button className="w-full">
                  Explore Specifications
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Pathology Bites Image Database</h3>
                <p className="text-muted-foreground">Visual learning library</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Proprietary high-quality pathology images with detailed annotations.
              </p>
              <Link href="/tools/image-collection">
                <Button className="w-full">
                  Browse Images
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Essential Molecular Syndrome Bites</h3>
                <p className="text-muted-foreground">Coming soon</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                High-yield molecular syndrome concepts and accompanying virtual slides.
              </p>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Cell Identification Quiz</h3>
                <p className="text-muted-foreground">Test your hematology skills</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Quiz with 500+ cell images across myeloid, erythroid, and bone marrow categories.
              </p>
              <Link href="/tools/cell-quiz">
                <Button className="w-full">
                  Start Quiz
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Lupus Anticoagulant Calculator</h3>
                <p className="text-muted-foreground">Calculate lupus anticoagulant results</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Comprehensive calculator for lupus anticoagulant testing with automated interpretation.
              </p>
              <Link href="/tools/lupus-anticoagulant">
                <Button className="w-full">
                  Calculate Results
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Citation Generator</h3>
                <p className="text-muted-foreground">Generate academic citations</p>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Generate citations in APA, MLA, AMA, and Vancouver styles.
              </p>
              <Link href="/tools/citations">
                <Button className="w-full">
                  Generate Citations
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>


      {/* Virtual Slide Search Engine Section */}
      <section className="relative py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold">
                  Virtual Slide Search Engine
                </h2>
                <p className="text-xl text-muted-foreground">
                  Access thousands of virtual pathology slides from leading institutions worldwide
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">Search across multiple prestigious institutions including Leeds, PathPresenter, MGH, and University of Toronto</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">High-resolution virtual microscopy for detailed examination</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">Comprehensive case studies with diagnostic information</p>
                  </div>
                </div>
                <div className="pt-4">
                  <Link href="/tools/virtual-slides">
                    <Button size="lg" className="px-8">
                      Explore Virtual Slides
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="space-y-4">
                  {/* Top row - 2 logos */}
                  <div className="flex justify-center gap-6">
                    <div className="w-32 h-20 bg-white rounded-lg shadow-sm border flex items-center justify-center p-3">
                      <Image
                        src="/logos/university-of-leeds-logo.png"
                        alt="University of Leeds"
                        width={120}
                        height={60}
                        className="object-contain"
                      />
                    </div>
                    <div className="w-32 h-20 bg-white rounded-lg shadow-sm border flex items-center justify-center p-3">
                      <Image
                        src="/logos/path-presenter-logo.png"
                        alt="PathPresenter"
                        width={120}
                        height={60}
                        className="object-contain"
                      />
                    </div>
                  </div>

                  {/* Middle row - 3 logos */}
                  <div className="flex justify-center gap-4">
                    <div className="w-28 h-18 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2">
                      <Image
                        src="/logos/mgh-logo.png"
                        alt="MGH"
                        width={100}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                    <div className="w-28 h-18 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2">
                      <Image
                        src="/logos/university-of-toronto-logo.png"
                        alt="University of Toronto"
                        width={100}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                    <div className="w-28 h-18 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2">
                      <Image
                        src="/logos/rosai-collection-logo.png"
                        alt="Rosai Collection"
                        width={100}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                  </div>

                  {/* Bottom row - 2 logos (removed AANP) */}
                  <div className="flex justify-center gap-4">
                    <div className="w-28 h-18 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2">
                      <Image
                        src="/logos/hematopathology-etutorial-logo.png"
                        alt="Hematopathology eTutorial"
                        width={100}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                    <div className="w-28 h-18 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2">
                      <Image
                        src="/logos/recut-club-logo.png"
                        alt="Recut Club"
                        width={100}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
      <section className="relative py-16 bg-muted/30">
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Questions Ready */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.questions.toLocaleString()}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Practice Questions</div>
              <div className="text-sm text-muted-foreground">Ready to challenge you</div>
            </div>

            {/* Images */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.images.toLocaleString()}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Visual Cases</div>
              <div className="text-sm text-muted-foreground">Real pathology images</div>
            </div>

            {/* Categories */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.categories}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Specialties</div>
              <div className="text-sm text-muted-foreground">Complete coverage</div>
            </div>
          </div>
        </div>
      </section>

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
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold
                    transform hover:scale-105 active:scale-95
                    hover:shadow-xl hover:shadow-white/10
                    transition-all duration-300 ease-in-out
                    relative overflow-hidden"
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
                    flex items-center gap-3"
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