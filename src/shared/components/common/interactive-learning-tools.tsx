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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {/* Row 1: Core Learning Resources & Quiz Tools */}
          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Image Database</h3>
              <p className="text-sm text-muted-foreground font-medium">Visual learning library</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Proprietary high-quality pathology images with detailed annotations.
            </p>
            <Link href="/tools/images" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Browse Images
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">ABPath Content</h3>
              <p className="text-sm text-muted-foreground font-medium">ABPath content specs</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Board-exam content specificaions. Filter by section, category, and designation.
            </p>
            <Link href="/tools/abpath" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Explore Specifications
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Hemepath Quiz</h3>
              <p className="text-sm text-muted-foreground font-medium">Learn bone marrow cells</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Quiz with 500+ cell images across myeloid, erythroid, and bone marrow categories.
            </p>
            <Link href="/tools/cell-quiz" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Quiz
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Digital Slides</h3>
              <p className="text-sm text-muted-foreground font-medium">AI-generated questions</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              AI-generated multiple choice questions based on digital slides.
            </p>
            <Link href="/tools/wsi-question-generator" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Learn More
              </Button>
            </Link>
          </div>

          {/* Row 2: Laboratory & Reference Tools */}
          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Cell Counter</h3>
              <p className="text-sm text-muted-foreground font-medium">Efficient cell counting</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Customizable cell counter with keyboard shortcuts for differential counts.
            </p>
            <Link href="/tools/cell-counter" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Counting
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">LAC Calculator</h3>
              <p className="text-sm text-muted-foreground font-medium">Lupus anticoagulant</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Comprehensive calculator for lupus anticoagulant with automated interpretation.
            </p>
            <Link href="/tools/lupus-anticoagulant" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Calculate Results
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Gene Lookup</h3>
              <p className="text-sm text-muted-foreground font-medium">Molecular references</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Comprehensive gene information database with HGNC, Hamronizome, and COSMIC referenes.
            </p>
            <Link href="/tools/gene-lookup" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Search Genes
              </Button>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">Citations</h3>
              <p className="text-sm text-muted-foreground font-medium">Make academic citations</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-1">
              Generate citations in APA, MLA, AMA, and Vancouver styles.
            </p>
            <Link href="/tools/citations" className="mt-auto">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Generate Citations
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
