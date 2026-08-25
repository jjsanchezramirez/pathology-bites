"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

/* Code-split, and never server-rendered: it is ~175 kB of three.js against a
 * homepage that ships 12 kB of its own, and it draws to a canvas so there is
 * nothing for the server to render anyway. Still fetched on mount rather than
 * on scroll -- it sits in the hero, so it is on screen immediately. */
const KnowledgeCloud = dynamic(
  () =>
    import("@/features/public/knowledge-graph/components/knowledge-cloud").then(
      (m) => m.KnowledgeCloud
    ),
  { ssr: false }
);
import { VirtualSlideSearchTeaser } from "@/shared/components/common/virtual-slide-search-teaser";

/**
 * The backdrop's edge, and the reason the copy stays readable on top of it.
 *
 * The cloud is framed vertically, so it is as wide as it is tall and it sits
 * in the middle of its own box -- which is why the box below is square and the
 * mask is measured as a fraction of it: radii of `50% / framing` land the fade
 * exactly on the outermost nodes, on every viewport, without knowing the
 * aspect. Change one and change the other, or the fade drifts off the cloud
 * and the dots get an edge again.
 *
 * The centre is nudged right of the box's own centre so the fade is not
 * symmetric: the side the headline sits on thins out a good deal earlier than
 * the open side, which is what keeps the text on a wash rather than on dots.
 */
const HERO_FADE =
  "radial-gradient(ellipse 42% 42% at 56% 50%, #000 0%, rgba(0,0,0,0.92) 42%, rgba(0,0,0,0.45) 68%, rgba(0,0,0,0.14) 86%, transparent 100%)";

interface HeroSectionProps {
  onLearnMoreClick?: () => void;
}

export function HeroSection({ onLearnMoreClick }: HeroSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

      {/* The knowledge graph, as the hero's backdrop rather than a panel beside
          it: the copy now sits on top of it. Still gated at lg, so phones do
          not pay for a WebGL canvas they never see.

          The whole cloud is on screen, and it is a sphere, so its size is one
          number: the side of the square box. Both axes get a say and the
          smaller one wins.

          Height caps it so it never runs off the top -- `framing` above 1 then
          keeps the outermost nodes about 8% of the section clear of the top
          and bottom. Width caps it so it never runs into the copy: anchored
          4% off the right edge, a box of 52vw puts the leftmost nodes at about
          48% of the viewport whatever the window is doing, so a narrow window
          gets a smaller cloud rather than one sitting on the headline. Tall
          and narrow is exactly the case that used to break -- at 1024x900 the
          height rule alone reached 15% of the width, most of the way across
          the text.

          The canvas clips at its own edges, so `framing` below 1 is what puts
          straight sides back on the cloud. If it ever needs to be bigger than
          the viewport again, overhang the section vertically and keep the box
          square, rather than zooming past it. */}
      <div
        className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-[4%] aspect-square z-0"
        style={{ height: "min(100%, 52vw)" }}
      >
        <KnowledgeCloud mask={HERO_FADE} framing={1.2} />
      </div>

      {/* Content Container */}
      {/* Transparent to the pointer, so dragging anywhere the copy is not
          spins the cloud underneath; the pieces that need events opt back in
          one by one below. */}
      <div className="container mx-auto px-4 relative z-10 pointer-events-none">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 items-center min-h-[calc(100vh-8rem)] pt-8 pb-24 lg:pt-0 lg:pb-0">
            {/* Left Column - Text Content (3/5 width) */}
            <div className="lg:col-span-3 space-y-8 lg:space-y-10 text-center lg:text-left">
              {/* Main Headline & Value Proposition */}
              <div className="space-y-5">
                <h1
                  className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight opacity-0 pointer-events-auto"
                  style={{
                    animation: mounted
                      ? "slideUpFade 1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                      : "none",
                  }}
                >
                  Pathology learning{" "}
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    by residents, for residents
                  </span>
                </h1>
                <p
                  className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0 opacity-0 pointer-events-auto"
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
                  className="opacity-0 pointer-events-auto"
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
                    className="text-base text-primary hover:underline font-semibold inline-flex items-center gap-1 group pointer-events-auto"
                  >
                    <span>Or try our question bank</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* The right two columns are deliberately empty: the graph is
                behind all five now, and this is what keeps the copy off it. */}
          </div>
        </div>
      </div>

      {/* Learn More Button - Positioned at bottom center */}
      <div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 opacity-0"
        style={{
          animation: mounted ? "fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
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
