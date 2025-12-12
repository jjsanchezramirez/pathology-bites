'use client'

import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { OrganicImageGallery } from "@/shared/components/common/organic-image-gallery"

interface HeroSectionProps {
  onLearnMoreClick?: () => void
}

export function HeroSection({ onLearnMoreClick }: HeroSectionProps) {
  const scrollToNext = () => {
    const nextSection = document.getElementById('learn-more-section')
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' })
    }
    onLearnMoreClick?.()
  }

  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden bg-gradient-to-br from-background via-primary/[0.02] to-background">
      {/* Content Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-8rem)]">

          {/* Left Column - Text Content */}
          <div className="space-y-8 text-center lg:text-left">
            {/* Main Headline */}
            <div className="space-y-4 animate-fade-in">
              <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                Welcome to{" "}
                <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                  Pathology Bites
                </span>
              </h1>
            </div>

            {/* Supporting Text */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Master pathology with bite-sized, interactive learning designed by residents for residents
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg
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
                  className="px-8 py-6 text-lg hover:bg-primary/5 hover:border-primary/50
                    transform hover:scale-105 active:scale-95
                    transition-all duration-300 ease-in-out"
                >
                  I Have an Account
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <p className="text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.6s' }}>
              Join thousands of medical students and residents • 100% Free • No credit card required
            </p>
          </div>

          {/* Right Column - Organic Image Gallery */}
          <div className="hidden lg:block relative h-[600px]">
            <OrganicImageGallery />
          </div>

        </div>
      </div>

      {/* Learn More Button - Positioned at bottom center */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={scrollToNext}
          className="group flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-all duration-300"
          aria-label="Learn more about Pathology Bites"
        >
          <span className="text-sm font-medium">Learn more</span>
          <ChevronDown className="h-5 w-5 animate-bounce group-hover:animate-none group-hover:translate-y-1 transition-transform" />
        </button>
      </div>
    </section>
  )
}

