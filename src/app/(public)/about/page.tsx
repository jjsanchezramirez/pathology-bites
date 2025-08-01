// src/app/about/page.tsx
import { Metadata } from 'next'
import { generateAboutPageMetadata } from '@/shared/components/seo/page-seo'
import { Button } from "@/shared/components/ui/button"

export const metadata: Metadata = generateAboutPageMetadata()
import Link from "next/link"
import { JoinCommunitySection } from "@/shared/components/common/join-community-section"
import { PublicHero } from '@/shared/components/common/public-hero'
import { PublicStatsSection } from '@/shared/components/common/public-stats-section'
import { WhyChoosePathologyBites } from '@/shared/components/common/why-choose-pathology-bites'

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">

      {/* Hero Section */}
      <PublicHero
        title={
          <h1 className="text-3xl md:text-5xl font-bold">
            About{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
              Pathology Bites
            </span>
          </h1>
        }
        description="We believe quality pathology education should be accessible to all. Our platform provides comprehensive practice questions, detailed explanations, and learning resources - completely free, forever."
        actions={
          <div className="flex gap-4 pt-2">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Start Learning Today
              </Button>
            </Link>
          </div>
        }
      />
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
      <WhyChoosePathologyBites />

      {/* Our Story Section */}
      <section className="relative py-20 bg-white dark:bg-slate-950">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/3 to-transparent" />
        <div className="container px-4 max-w-4xl mx-auto relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Story</h2>
            <p className="text-xl text-muted-foreground">
              Built by pathology residents, for the pathology community
            </p>
          </div>
          <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Pathology Bites grew out of residents sharing study materials with each other. We saw how much better resources became when the community collaborated - questions written by people who just took boards, explanations that actually made sense, real insight into what matters. We formalized that collaboration into a platform where the pathology community can contribute and access high-quality practice questions. The goal: make effective board preparation available to every resident, regardless of their program's resources.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <PublicStatsSection variant="about" className="bg-muted/30" />

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Section */}
      <JoinCommunitySection
        description="Ready to advance your pathology knowledge? Join our community of learners and start your journey today - completely free, forever."
      />
    </div>
  )
}