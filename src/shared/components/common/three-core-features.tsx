// src/shared/components/common/three-core-features.tsx
'use client'

import { Target, Microscope, Wrench } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"


interface ThreeCoreFeaturesProps {
  className?: string
}

export function ThreeCoreFeatures({ className = "" }: ThreeCoreFeaturesProps) {
  const features = [
    {
      icon: Target,
      title: "Comprehensive Question Bank",
      description: "Unlimited AI-generated questions plus expert-curated content covering all 22 pathology subspecialties with detailed explanations",
      screenshot: "/images/screenshots/qbank-preview.png",
      screenshotAlt: "Pathology Bites question bank interface showing interactive quiz with detailed explanations",
      ctaText: "Start Practicing",
      ctaHref: "/signup",
      badge: "∞ Questions"
    },
    {
      icon: Microscope,
      title: "Whole Slide Image Library",
      description: "Search thousands of high-resolution digital pathology slides from top institutions including Leeds, MGH, PathPresenter, and University of Toronto",
      screenshot: "/images/screenshots/wsi-search-preview.png",
      screenshotAlt: "Virtual slide search engine showing whole slide images from multiple institutions",
      ctaText: "Browse Slides",
      ctaHref: "/tools/virtual-slides",
      badge: "1000+ Slides"
    },
    {
      icon: Wrench,
      title: "Interactive Learning Tools",
      description: "Anki deck visualizer, differential cell counter, gene finder, LAC calculator, and specialized study tools built for pathology residents",
      screenshot: "/images/screenshots/tools-preview.png",
      screenshotAlt: "Interactive learning tools including Anki deck visualizer and cell counter",
      ctaText: "Explore Tools",
      ctaHref: "/tools",
      badge: "8+ Tools"
    }
  ]

  return (
    <section className={`relative py-24 bg-gradient-to-b from-background to-muted/30 ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Three Platforms in One
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to master pathology, integrated into a single powerful platform
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Screenshot */}
                <div className="relative h-64 bg-muted overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
                  {/* Placeholder - will be replaced with actual screenshot */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-24 h-24 text-primary/20" />
                  </div>
                  {/* Uncomment when screenshots are ready */}
                  {/* <Image
                    src={feature.screenshot}
                    alt={feature.screenshotAlt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  /> */}

                  {/* Badge overlay */}
                  <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                    {feature.badge}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>

                  <Link href={feature.ctaHref}>
                    <Button
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      variant="outline"
                    >
                      {feature.ctaText}
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
