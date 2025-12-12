// src/shared/components/common/public-stats-section.tsx
'use client'

import { usePublicStats } from "@/shared/hooks/use-public-stats"

interface PublicStatsSectionProps {
  className?: string
  variant?: 'landing' | 'coming-soon' | 'about'
}

export function PublicStatsSection({ className = "", variant = 'landing' }: PublicStatsSectionProps) {
  const { stats, loading: statsLoading } = usePublicStats()

  const getLabels = () => {
    switch (variant) {
      case 'coming-soon':
        return {
          aiQuestions: { title: 'AI-Generated Questions', subtitle: 'Unlimited practice material' },
          expertQuestions: { title: 'Expert-Curated Questions', subtitle: 'High-quality content' },
          categories: { title: 'Pathology Subspecialties', subtitle: 'Complete coverage' }
        }
      case 'about':
        return {
          aiQuestions: { title: 'AI-Generated Questions', subtitle: 'Unlimited practice material' },
          expertQuestions: { title: 'Expert-Curated Questions', subtitle: 'High-quality content' },
          categories: { title: 'Pathology Subspecialties', subtitle: 'Complete coverage' }
        }
      default: // landing
        return {
          aiQuestions: { title: 'AI-Generated Questions', subtitle: 'Unlimited practice material' },
          expertQuestions: { title: 'Expert-Curated Questions', subtitle: 'High-quality content' },
          categories: { title: 'Pathology Subspecialties', subtitle: 'Complete coverage' }
        }
    }
  }

  const labels = getLabels()

  return (
    <section className={`relative py-16 ${className}`}>
      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* AI-Generated Questions */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? '...' : '∞'}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">{labels.aiQuestions.title}</div>
            <div className="text-sm text-muted-foreground">{labels.aiQuestions.subtitle}</div>
          </div>

          {/* Expert-Curated Questions */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? '...' : stats.expertQuestions.toLocaleString()}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">{labels.expertQuestions.title}</div>
            <div className="text-sm text-muted-foreground">{labels.expertQuestions.subtitle}</div>
          </div>

          {/* Categories */}
          <div className="text-center group">
            <div className="relative">
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                {statsLoading ? '...' : stats.categories}
              </div>
              <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-1">{labels.categories.title}</div>
            <div className="text-sm text-muted-foreground">{labels.categories.subtitle}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
