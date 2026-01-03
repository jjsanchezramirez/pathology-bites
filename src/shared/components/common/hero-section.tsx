"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { OrganicImageGallery } from "@/shared/components/common/organic-image-gallery";
import { VirtualSlideSearchTeaser } from "@/shared/components/common/virtual-slide-search-teaser";

interface HeroSectionProps {
  onLearnMoreClick?: () => void;
}

export function HeroSection({ onLearnMoreClick }: HeroSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Trigger shimmer after all other animations complete
    const shimmerTimer = setTimeout(() => {
      setShowShimmer(true);
    }, 1800); // Start shimmer after 1.8s (when other animations finish)

    return () => clearTimeout(shimmerTimer);
  }, []);

  const scrollToNext = () => {
    const nextSection = document.getElementById("learn-more-section");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
    onLearnMoreClick?.();
  };

  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden">
      {/* Background gradients matching other hero sections */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />

      {/* Content Container */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 items-center min-h-[calc(100vh-8rem)] pt-8 pb-24 lg:pt-0 lg:pb-0">
            {/* Left Column - Text Content (3/5 width) */}
            <div className="lg:col-span-3 space-y-8 lg:space-y-10 text-center lg:text-left">
              {/* Main Headline & Value Proposition */}
              <div className="space-y-5">
                <h1
                  className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight opacity-0"
                  style={{
                    animation: mounted
                      ? "slideUpFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                      : "none",
                  }}
                >
                  Pathology learning{" "}
                  <span
                    className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent"
                    style={{
                      backgroundSize: showShimmer ? "200% auto" : "100% auto",
                      animation: showShimmer ? "shimmer 2s linear forwards" : "none",
                      animationIterationCount: showShimmer ? "1" : "0",
                    }}
                  >
                    by residents, for residents
                  </span>
                </h1>
                <p
                  className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0 opacity-0"
                  style={{
                    animation: mounted
                      ? "slideUpFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                      : "none",
                    animationDelay: mounted ? "0.2s" : "0s",
                  }}
                >
                  Explore our virtual slide library or sharpen your skills with our question bank
                </p>
              </div>

              {/* Dual CTAs Section */}
              <div className="space-y-5">
                {/* Search Bar */}
                <div
                  className="opacity-0"
                  style={{
                    animation: mounted
                      ? "scaleInFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                      : "none",
                    animationDelay: mounted ? "0.5s" : "0s",
                  }}
                >
                  <VirtualSlideSearchTeaser />
                </div>

                {/* Account CTA */}
                <div
                  className="text-center lg:text-left opacity-0"
                  style={{
                    animation: mounted
                      ? "slideInFromLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                      : "none",
                    animationDelay: mounted ? "0.8s" : "0s",
                  }}
                >
                  <Link
                    href="/signup"
                    className="text-base text-primary hover:underline font-semibold inline-flex items-center gap-1 group"
                  >
                    <span>Or try our question bank</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column - Organic Image Gallery (2/5 width) */}
            <div className="hidden lg:block lg:col-span-2 relative h-[600px]">
              <OrganicImageGallery />
            </div>
          </div>
        </div>
      </div>

      {/* Learn More Button - Positioned at bottom center */}
      <div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 opacity-0"
        style={{
          animation: mounted
            ? "fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            : "none",
          animationDelay: mounted ? "1.2s" : "0s",
        }}
      >
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
  );
}
