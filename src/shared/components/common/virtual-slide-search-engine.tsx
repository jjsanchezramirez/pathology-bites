// src/shared/components/common/virtual-slide-search-engine.tsx
import Link from "next/link"
import { Button } from "@/shared/components/ui/button"
import { MouseAvoidingLogos } from "./mouse-avoiding-logos"

interface VirtualSlideSearchEngineProps {
  /** Optional ID for the section (useful for navigation) */
  id?: string
  /** Additional CSS classes for the section */
  className?: string
  /** Whether to show the MouseAvoidingLogos component (default: true) */
  showLogos?: boolean
}

export function VirtualSlideSearchEngine({
  id,
  className = "",
  showLogos = true
}: VirtualSlideSearchEngineProps) {
  
  return (
    <section id={id} className={`relative py-24 bg-muted/30 ${className}`}>
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
              <div className="pt-4 flex justify-center lg:justify-start">
                <Link href="/tools/virtual-slides">
                  <Button size="lg" className="px-8">
                    Explore Virtual Slides
                  </Button>
                </Link>
              </div>

              {/* Mini Disclaimer */}
              <div className="pt-6 text-xs text-muted-foreground">
                <p><span className="font-medium">Content:</span> Links to third-party repositories. No ownership claimed.</p>
              </div>
            </div>

            {showLogos && (
              <div className="relative hidden lg:block">
                <MouseAvoidingLogos />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
