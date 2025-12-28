// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top"
import ComingSoonPage from "./coming-soon/page"
import MaintenancePage from "./maintenance/page"
import { PublicStatsSection } from "@/shared/components/common/public-stats-section"
import { WhyChoosePathologyBites } from "@/shared/components/common/why-choose-pathology-bites"
import { VirtualSlideSearchEngine } from "@/shared/components/common/virtual-slide-search-engine"
import { HeroSection } from "@/shared/components/common/hero-section"
import { DemoQuestionSection } from "@/shared/components/common/demo-question-section"
import { FinalCTASection } from "@/shared/components/common/final-cta-section"

export default function LandingPage() {
  const [bypassEnabled, setBypassEnabled] = useState(false)

  // Check if maintenance mode is enabled (takes priority over coming soon)
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  // Check if coming soon mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  // Preload virtual-slides.json in background for faster tool experience
  useEffect(() => {
    // Prefetch the virtual-slides.json file from R2 CDN
    // This makes the virtual slides tool load instantly when user clicks
    const prefetchTimer = setTimeout(() => {
      const VIRTUAL_SLIDES_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'
      fetch(VIRTUAL_SLIDES_URL, {
        method: 'GET',
        cache: 'force-cache',
        priority: 'low'
      } as RequestInit).catch(() => {
        // Silently fail - this is just a performance optimization
      })
    }, 2000) // Wait 2 seconds after page load to avoid blocking initial render

    return () => clearTimeout(prefetchTimer)
  }, [])

  // Check for bypass on mount (dev mode only)
  useEffect(() => {
    // Check URL parameter for dev bypass only
    const urlParams = new URLSearchParams(window.location.search)
    const bypassParam = urlParams.get('bypass')

    if (process.env.NODE_ENV !== 'production' && bypassParam === 'true') {
      setBypassEnabled(true)
    }
  }, [])

  // If maintenance mode is enabled and no bypass, show the maintenance page (highest priority)
  if (isMaintenanceMode && !bypassEnabled) {
    return <MaintenancePage />
  }

  // If coming soon mode is enabled and no bypass, show the coming soon page
  if (isComingSoonMode && !bypassEnabled) {
    return <ComingSoonPage />
  }

  return (
    <>
      <HeroSection />
      <WhyChoosePathologyBites id="learn-more-section" />
      <VirtualSlideSearchEngine />
      <DemoQuestionSection />
      <PublicStatsSection variant="landing" className="bg-muted/30" />
      <FinalCTASection />
      <ScrollToTopButton />
    </>
  )
}