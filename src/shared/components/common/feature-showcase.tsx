// src/shared/components/common/feature-showcase.tsx
'use client'

import { Check } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import Link from "next/link"


interface FeatureShowcaseProps {
  title: string
  description: string
  features: string[]
  screenshot: string
  screenshotAlt: string
  ctaText: string
  ctaHref: string
  imageOnLeft?: boolean
  className?: string
}

export function FeatureShowcase({
  title,
  description,
  features,
  screenshot,
  screenshotAlt,
  ctaText,
  ctaHref,
  imageOnLeft = false,
  className = ""
}: FeatureShowcaseProps) {
  return (
    <section className={`relative py-24 ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto ${imageOnLeft ? 'lg:grid-flow-dense' : ''}`}>
          {/* Content */}
          <div className={`space-y-6 ${imageOnLeft ? 'lg:col-start-2' : ''}`}>
            <div className="space-y-4">
              <h2 className="text-4xl font-bold">{title}</h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>

            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-primary/10 rounded-full flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4">
              <Link href={ctaHref}>
                <Button size="lg" className="px-8">
                  {ctaText}
                </Button>
              </Link>
            </div>
          </div>

          {/* Screenshot */}
          <div className={`relative ${imageOnLeft ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border bg-muted">
              {/* Placeholder - will be replaced with actual screenshot */}
              <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                <div className="text-center text-muted-foreground p-8">
                  <div className="text-6xl mb-4">📸</div>
                  <p className="text-sm">Screenshot placeholder</p>
                  <p className="text-xs mt-2">Replace with: {screenshot}</p>
                </div>
              </div>
              {/* Uncomment when screenshots are ready */}
              {/* <Image
                src={screenshot}
                alt={screenshotAlt}
                width={1200}
                height={900}
                className="w-full h-auto"
                sizes="(max-width: 1024px) 100vw, 50vw"
              /> */}

              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
            </div>

            {/* Decorative element */}
            <div className="absolute -inset-4 bg-primary/5 rounded-xl -z-10 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
