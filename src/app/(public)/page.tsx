// src/app/page.tsx
'use client'

import { FeatureCard } from "@/components/landing/feature-card"
import { ScrollToTopButton } from "@/components/landing/scroll-to-top"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpenIcon, BarChartIcon, TestTube2Icon } from "lucide-react"
import DemoQuestion from "@/components/landing/demo-question"

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        {/* Content Container */}
        <div className="container px-4 sm:px-6 lg:px-8 relative flex justify-center">
          <div className="relative max-w-4xl space-y-8 text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
              Master Pathology with{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Bite-Sized Learning
              </span>
            </h1>

            <div className="space-y-8 animate-fade-in opacity-0" style={{ animationDelay: '0.7s' }}>
              <p className="mx-auto max-w-[42rem] text-xl text-muted-foreground">
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
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
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

      {/* Demo Question Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
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
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-foreground/10 to-transparent" />
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