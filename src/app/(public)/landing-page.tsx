import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top";
import { PublicStatsSection } from "@/shared/components/common/public-stats-section";
import { WhyChoosePathologyBites } from "@/shared/components/common/why-choose-pathology-bites";
import { VirtualSlideSearchEngine } from "@/shared/components/common/virtual-slide-search-engine";
import { HeroSection } from "@/shared/components/common/hero-section";
import { DemoQuestionSection } from "@/shared/components/common/demo-question-section";
import { FinalCTASection } from "@/shared/components/common/final-cta-section";
import { ScrollReveal } from "@/shared/components/common/scroll-reveal";
import { HomepageAskAlbright } from "@/features/user/ask-albright/components/homepage-ask-albright";
import { ASK_ALBRIGHT_ENABLED } from "@/features/user/ask-albright/lib/enabled";

// The virtual-slides corpus (~2 MB brotli / ~27 MB decompressed) is loaded LAZILY by
// the hero teaser — deferred to browser-idle / first hero interaction so it stays off
// the homepage's initial-load critical path (it was tanking LCP/TBT). Don't add an
// eager prefetch here — see virtual-slide-search-teaser.tsx and commit history.

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
      {/* Dr. Albright owns the bottom-right corner; scroll-to-top moves left. */}
      <ScrollToTopButton className={ASK_ALBRIGHT_ENABLED ? "left-8 right-auto" : undefined} />
      <HomepageAskAlbright />
    </>
  );
}
