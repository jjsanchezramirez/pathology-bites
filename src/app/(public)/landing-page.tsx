"use client";

import { useEffect } from "react";
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top";
import { PublicStatsSection } from "@/shared/components/common/public-stats-section";
import { WhyChoosePathologyBites } from "@/shared/components/common/why-choose-pathology-bites";
import { VirtualSlideSearchEngine } from "@/shared/components/common/virtual-slide-search-engine";
import { HeroSection } from "@/shared/components/common/hero-section";
import { DemoQuestionSection } from "@/shared/components/common/demo-question-section";
import { FinalCTASection } from "@/shared/components/common/final-cta-section";
import { ScrollReveal } from "@/shared/components/common/scroll-reveal";

export function LandingPage() {
  // Preload virtual-slides.json in background for faster tool experience
  useEffect(() => {
    // Prefetch the virtual-slides.json file from R2 CDN
    // This makes the virtual slides tool load instantly when user clicks
    const prefetchTimer = setTimeout(() => {
      const VIRTUAL_SLIDES_URL =
        "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json";
      fetch(VIRTUAL_SLIDES_URL, {
        method: "GET",
        cache: "force-cache",
        priority: "low",
      } as RequestInit).catch(() => {
        // Silently fail - this is just a performance optimization
      });
    }, 2000); // Wait 2 seconds after page load to avoid blocking initial render

    return () => clearTimeout(prefetchTimer);
  }, []);

  return (
    <>
      <HeroSection />
      <ScrollReveal animation="fade-up">
        <WhyChoosePathologyBites id="learn-more-section" />
      </ScrollReveal>
      <ScrollReveal animation="fade-up">
        <VirtualSlideSearchEngine />
      </ScrollReveal>
      <ScrollReveal animation="scale-in">
        <DemoQuestionSection />
      </ScrollReveal>
      <ScrollReveal animation="fade-up">
        <PublicStatsSection variant="landing" className="bg-muted/30" />
      </ScrollReveal>
      <ScrollReveal animation="fade-up">
        <FinalCTASection />
      </ScrollReveal>
      <ScrollToTopButton />
    </>
  );
}
