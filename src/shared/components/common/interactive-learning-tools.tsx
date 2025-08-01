// src/shared/components/common/interactive-learning-tools.tsx
import Link from "next/link"
import { Button } from "@/shared/components/ui/button"

interface InteractiveLearningToolsProps {
  /** Optional ID for the section (useful for navigation) */
  id?: string
  /** Additional CSS classes for the section */
  className?: string
}

export function InteractiveLearningTools({
  id,
  className = ""
}: InteractiveLearningToolsProps) {
  
  return (
    <section id={id} className={`relative py-24 ${className}`}>
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Interactive Learning Tools
          </h2>
          <p className="text-xl text-muted-foreground">
            Practice with our specialized tools designed to enhance your diagnostic skills
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Interactive ABPath Content Specifications</h3>
              <p className="text-muted-foreground">Board-aligned learning</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Filter by section, category, and designation – Core, Advance Resident, Fellow
            </p>
            <Link href="/tools/abpath">
              <Button className="w-full">
                Explore Specifications
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Pathology Bites Image Database</h3>
              <p className="text-muted-foreground">Visual learning library</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Proprietary high-quality pathology images with detailed annotations.
            </p>
            <Link href="/tools/images">
              <Button className="w-full">
                Browse Images
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Essential Molecular Syndrome Bites</h3>
              <p className="text-muted-foreground">Coming soon</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              High-yield molecular syndrome concepts and accompanying virtual slides.
            </p>
            <Button className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">WSI Question Generator (Beta)</h3>
              <p className="text-muted-foreground">AI-powered virtual slide questions</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Practice with AI-generated questions based on real virtual slide images and educational content.
            </p>
            <Link href="/tools/wsi-question-generator">
              <Button className="w-full">
                Generate Questions
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Cell Identification Quiz</h3>
              <p className="text-muted-foreground">Test your hematology skills</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Quiz with 500+ cell images across myeloid, erythroid, and bone marrow categories.
            </p>
            <Link href="/tools/cell-quiz">
              <Button className="w-full">
                Start Quiz
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Lupus Anticoagulant Calculator</h3>
              <p className="text-muted-foreground">Calculate lupus anticoagulant results</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Comprehensive calculator for lupus anticoagulant testing with automated interpretation.
            </p>
            <Link href="/tools/lupus-anticoagulant">
              <Button className="w-full">
                Calculate Results
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-background p-8 hover:shadow-lg transition-all duration-300">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Citation Generator</h3>
              <p className="text-muted-foreground">Generate academic citations</p>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Generate citations in APA, MLA, AMA, and Vancouver styles.
            </p>
            <Link href="/tools/citations">
              <Button className="w-full">
                Generate Citations
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
