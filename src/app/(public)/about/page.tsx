// src/app/about/page.tsx
import { Metadata } from 'next'
import { generateAboutPageMetadata } from '@/shared/components/seo/page-seo'
import { Button } from "@/shared/components/ui/button"

export const metadata: Metadata = generateAboutPageMetadata()
import Link from "next/link"
import {
  BookOpenIcon,
  UsersIcon,
  Target,
  Heart,
  Zap,
  GitBranch
} from "lucide-react"
import { JoinCommunitySection } from "@/shared/components/common/join-community-section"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">

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
              About{" "}
              <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Pathology Bites
              </span>
            </h1>

            {/* Supporting Content */}
            <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.5s' }}>
              <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
                We believe quality pathology education should be accessible to all. Our platform provides
                comprehensive practice questions, detailed explanations, and learning resources - completely free, forever.
              </p>
            </div>

            {/* CTA Button */}
            <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.9s' }}>
              <div className="flex justify-center pt-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 transform hover:scale-105 transition-all duration-300 ease-in-out px-8"
                  >
                    Start Learning Today
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Mission Section */}
      <section className="relative py-20 bg-primary">
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Our Mission</h2>
          <p className="text-xl mb-8 leading-relaxed text-white">
            To democratize pathology education by providing high-quality, accessible learning
            resources to medical students, residents, and pathologists worldwide. We believe
            that breaking down barriers to education creates better pathologists and ultimately
            improves patient care.
          </p>
        </div>
      </section>

      {/* Why Choose Pathology Bites Section */}
      <section className="relative py-24 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
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
                    <BookOpenIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold">ABPath Aligned</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Every question maps to official pathology board content specifications, ensuring focused study.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <UsersIcon className="w-5 h-5 text-primary flex-shrink-0" />
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

      {/* Our Story Section */}
      <section className="relative py-20 bg-muted/30">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container px-4 max-w-4xl mx-auto relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Story</h2>
            <p className="text-xl text-muted-foreground">
              Built by pathology residents, for the pathology community
            </p>
          </div>
          <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Pathology Bites was born from the real challenges faced by pathology residents and students.
              We experienced firsthand the difficulty of finding high-quality, accessible practice questions
              and comprehensive learning resources.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Our platform combines the expertise of practicing pathologists with modern educational technology
              to create an engaging, effective learning experience. Every question is carefully crafted,
              every explanation is detailed, and every feature is designed with the learner in mind.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We're committed to keeping pathology education free and accessible because we believe that
              knowledge should never be behind a paywall. Join thousands of learners who are advancing
              their pathology knowledge with Pathology Bites.
            </p>
          </div>
        </div>
      </section>

      {/* Join Section */}
      <JoinCommunitySection
        description="Ready to advance your pathology knowledge? Join our community of learners and start your journey today - completely free, forever."
      />
    </div>
  )
}