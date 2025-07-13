// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { FeatureCard } from "@/shared/components/common/feature-card"
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top"
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { BookOpenIcon, BarChartIcon, TestTube2Icon, Microscope, Target, BookOpen, Dna, FileText } from "lucide-react"
import DemoQuestion from "@/shared/components/common/demo-question"
import ComingSoonPage from "./coming-soon/page"

export default function LandingPage() {
  const [bypassEnabled, setBypassEnabled] = useState(false)

  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

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
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        {/* Content Container */}
        <div className="container px-4 sm:px-6 lg:px-8 relative flex justify-center">
          <div className="relative max-w-4xl space-y-8 text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
              Master Pathology with{" "}
              <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Bite-Sized Learning
              </span>
            </h1>

            <div className="space-y-8 animate-fade-in opacity-0" style={{ animationDelay: '0.7s' }}>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                Elevate your diagnostic expertise with AI-powered case studies and personalized learning paths.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <h2 className="text-center text-4xl font-bold mb-16">
            Transform Your Learning Experience
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <FeatureCard
              icon={BookOpenIcon}
              title="Comprehensive Curriculum"
              description="Access our complete library of pathology questions covering all major subspecialties and board exam topics"
            />
            <FeatureCard
              icon={BarChartIcon}
              title="Smart Analytics"
              description="Track your progress with detailed performance analytics and competency heatmaps"
            />
            <FeatureCard
              icon={TestTube2Icon}
              title="Virtual Lab Cases"
              description="Practice with interactive case simulations featuring real histopathology slides"
            />
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
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="group relative overflow-hidden rounded-xl border bg-background p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center">
                  <Microscope className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Cell Identification Quiz</h3>
                  <p className="text-sm text-muted-foreground">Test your hematology skills</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Interactive quiz with 500+ cell images across myeloid, erythroid, peripheral blood, and bone marrow categories.
              </p>
              <Link href="/tools/cell-quiz">
                <Button className="w-full gap-2">
                  <Target className="h-4 w-4" />
                  Start Quiz
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center">
                  <Dna className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Gene Lookup Tool</h3>
                  <p className="text-sm text-muted-foreground">Search gene information</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive gene information from HGNC and Harmonizome databases with external resource links.
              </p>
              <Link href="/tools/gene-lookup">
                <Button className="w-full gap-2">
                  <Dna className="h-4 w-4" />
                  Search Genes
                </Button>
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-xl border bg-background p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-950/30 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Citation Generator</h3>
                  <p className="text-sm text-muted-foreground">Generate academic citations</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Generate properly formatted citations in APA, MLA, AMA, and Vancouver styles from URLs, DOIs, or ISBNs.
              </p>
              <Link href="/tools/citations">
                <Button className="w-full gap-2">
                  <FileText className="h-4 w-4" />
                  Generate Citations
                </Button>
              </Link>
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
              Experience Interactive Learning
            </h2>
            <p className="text-xl text-muted-foreground">
              Try a sample question from our extensive question bank
            </p>
          </div>
          <DemoQuestion />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-tr from-primary-foreground/10 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Open Educational Resource
            </h2>
            <p className="text-lg text-primary-foreground/90">
              Start your learning journey today. No fees, no subscriptions - just high-quality pathology education for everyone.
            </p>
            <div className="pt-4">
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-white/90 px-8
                    transform hover:scale-105 active:scale-95 
                    hover:shadow-xl hover:shadow-white/10
                    transition-all duration-300 ease-in-out 
                    relative overflow-hidden"
                >
                  Start Learning Now
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