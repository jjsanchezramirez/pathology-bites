// src/shared/components/common/public-stats-section.tsx
"use client";

import { usePublicStats } from "@/shared/hooks/use-public-stats";
import {
  useVirtualSlideCount,
  formatSlideCountApprox,
} from "@/shared/hooks/use-virtual-slide-count";

interface PublicStatsSectionProps {
  className?: string;
  variant?: "landing" | "about";
}

export function PublicStatsSection({
  className = "",
  variant = "landing",
}: PublicStatsSectionProps) {
  const { stats, loading: statsLoading } = usePublicStats();

  // Live count from the corpus manifest (auto-updates with each rebuild); floored fallback
  // until it resolves so the figure never overstates the live total.
  const slideCount = useVirtualSlideCount();
  const slideCountLabel = slideCount ? formatSlideCountApprox(slideCount) : "65,000+";

  const getLabels = () => {
    switch (variant) {
      case "about":
        return {
          aiQuestions: { title: "AI-Generated Questions", subtitle: "Unlimited practice material" },
          expertQuestions: { title: "Expert-Curated Questions", subtitle: "High-quality content" },
          images: { title: "Pathology Images", subtitle: "Across our question bank" },
          virtualSlides: { title: "Virtual Slides", subtitle: "Searchable WSI library" },
        };
      default: // landing
        return {
          aiQuestions: { title: "AI-Generated Questions", subtitle: "Unlimited practice material" },
          expertQuestions: { title: "Expert-Curated Questions", subtitle: "High-quality content" },
          images: { title: "Pathology Images", subtitle: "Across our question bank" },
          virtualSlides: { title: "Virtual Slides", subtitle: "Searchable WSI library" },
        };
    }
  };

  const labels = getLabels();

  return (
    <section className={`relative py-16 ${className}`}>
      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {/* AI-Generated Questions */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? "..." : "∞"}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">
              {labels.aiQuestions.title}
            </div>
            <div className="text-sm text-muted-foreground">{labels.aiQuestions.subtitle}</div>
          </div>

          {/* Expert-Curated Questions */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? "..." : `${stats.expertQuestions}+`}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">
              {labels.expertQuestions.title}
            </div>
            <div className="text-sm text-muted-foreground">{labels.expertQuestions.subtitle}</div>
          </div>

          {/* Images */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? "..." : `${stats.images.toLocaleString()}+`}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">{labels.images.title}</div>
            <div className="text-sm text-muted-foreground">{labels.images.subtitle}</div>
          </div>

          {/* Virtual Slides */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {slideCountLabel}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">
              {labels.virtualSlides.title}
            </div>
            <div className="text-sm text-muted-foreground">{labels.virtualSlides.subtitle}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
