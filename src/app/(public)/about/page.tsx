// src/app/about/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { 
  MicroscopeIcon, 
  GraduationCapIcon, 
  BookOpenIcon,
  UsersIcon,
  GlobeIcon,
  LightbulbIcon
} from "lucide-react"
import FloatingCharacter from "@/components/landing/dr-albright"
import { FeatureCard } from "@/components/landing/feature-card"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">

    {/* Hero Section */}
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
      
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between gap-8">
          {/* Content */}
          <div className="flex-1 space-y-6 max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold">
              Free Pathology Education for Everyone
            </h1>
            <p className="text-lg text-muted-foreground">
              We believe quality pathology education should be accessible to all. 
              Our platform provides comprehensive practice questions, detailed explanations, 
              and learning resources - completely free, forever.
            </p>
            <div>
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90"
                >
                  Start Learning
                </Button>
              </Link>
            </div>
          </div>

          {/* Character - hidden on mobile */}
          <div className="hidden md:block w-[350px]">
            <FloatingCharacter
              imagePath="/images/dr-albright.png"
              imageAlt="Dr. Albright Character"
              size={350}
              wrapperClassName="w-full flex justify-center"
            />
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

      {/* Features Grid */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container px-4 max-w-6xl mx-auto relative">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What We Offer</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={BookOpenIcon}
              title="Comprehensive Content"
              description="Expert-curated questions covering all major pathology subspecialties"
            />
            <FeatureCard
              icon={GlobeIcon}
              title="Open Access"
              description="Free access to all content and features, no subscription required"
            />
            <FeatureCard
              icon={GraduationCapIcon}
              title="Board Preparation"
              description="Questions aligned with current board examination formats"
            />
            <FeatureCard
              icon={UsersIcon}
              title="Community Learning"
              description="Learn alongside peers and benefit from shared knowledge"
            />
            <FeatureCard
              icon={LightbulbIcon}
              title="Detailed Explanations"
              description="In-depth explanations for every question to enhance understanding"
            />
            <FeatureCard
              icon={MicroscopeIcon}
              title="Quality Images"
              description="High-resolution pathology images with annotations"
            />
          </div>
        </div>
      </section>

      {/* Join Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Our Learning Community</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your learning journey today. No fees, no subscriptions - just 
            high-quality pathology education available to everyone.
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 transform hover:scale-105 
                        transition-all duration-300 ease-in-out"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}