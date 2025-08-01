// src/shared/components/common/why-choose-pathology-bites.tsx
import { BookOpen, Users, Target, Heart, Zap, GitBranch } from "lucide-react"

interface WhyChoosePathologyBitesProps {
  /** Optional ID for the section (useful for navigation) */
  id?: string
  /** Additional CSS classes for the section */
  className?: string
}

export function WhyChoosePathologyBites({ 
  id,
  className = ""
}: WhyChoosePathologyBitesProps) {
  return (
    <section 
      id={id} 
      className={`relative py-24 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800 ${className}`}
    >
      <div className="container mx-auto px-4 relative">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left Column - Title and Description */}
            <div className="space-y-6">
              <h2 className="text-4xl font-bold">
                Why choose{" "}
                <span className="text-primary underline decoration-primary/30">Pathology Bites?</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Built by pathology residents who understand the real challenges of board preparation.
                Every feature is designed to help you learn more efficiently and retain information better.
              </p>
            </div>

            {/* Right Column - Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">ABPath Aligned</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Every question maps to official pathology board content specifications, ensuring focused study.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">Resident Created</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Made by residents who recently took boards, with input from those who know what actually matters.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">High-Yield Focus</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Essential concepts and board-relevant topics, not obscure facts that won't help you succeed.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">Completely Free</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Open educational resource with no hidden costs, subscriptions, or premium tiers.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">Interactive Learning</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Bite-sized questions with instant feedback and detailed explanations for better retention.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-5 h-5 text-primary flex-shrink-0" />
                  <h3 className="font-semibold">Community Driven</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-8">
                  Open source project where residents and faculty contribute questions, images, and improvements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
