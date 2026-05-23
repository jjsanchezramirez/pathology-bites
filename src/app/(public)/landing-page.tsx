"use client";

import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top";
import { PublicStatsSection } from "@/shared/components/common/public-stats-section";
import { WhyChoosePathologyBites } from "@/shared/components/common/why-choose-pathology-bites";
import { VirtualSlideSearchEngine } from "@/shared/components/common/virtual-slide-search-engine";
import { HeroSection } from "@/shared/components/common/hero-section";
import { DemoQuestionSection } from "@/shared/components/common/demo-question-section";
import { FinalCTASection } from "@/shared/components/common/final-cta-section";
import { ScrollReveal } from "@/shared/components/common/scroll-reveal";

// Virtual-slides dataset is already prefetched by `useClientVirtualSlides`
// (the search hook the hero teaser mounts at the top of this page). Adding
// a second fetch here would just race the hook and triple-count the file
// in Lighthouse's "enormous network payloads" — see commit history.

export function LandingPage() {
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
