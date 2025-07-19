'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Microscope,
  Target,
  Lightbulb,
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import Image from 'next/image'
import cellData from '@/data/cell-data.json'
import bloodCellsReference from '@/data/blood_cells_reference.json'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

interface CellQuizTutorialProps {
  onComplete: () => void
}

// Helper function to find reference cell info by name (temporary until short_name is added)
function findReferenceCellInfo(cellName: string) {
  return bloodCellsReference.cells.find(refCell => {
    const refName = refCell.name.toLowerCase()
    const searchName = cellName.toLowerCase()

    // Direct matches
    if (searchName === refName) return true

    // Special cases for naming mismatches
    if (searchName === 'blast' && refName === 'myeloblast') return true
    if (searchName === 'promyelocyte' && refName === 'promyelocyte') return true
    if (searchName === 'lymphocyte' && refName === 'lymphocyte') return true
    if (searchName === 'monocyte' && refName === 'monocyte') return true
    if (searchName === 'basophilic erythroblast' && refName === 'basophilic erythroblast') return true
    if (searchName === 'polychromatophilic erythroblast' && refName === 'polychromatophilic erythroblast') return true
    if (searchName === 'orthochromic erythroblast' && refName === 'orthochromic erythroblast') return true
    if (searchName === 'segmented neutrophil' && refName === 'neutrophil (segmented or band)') return true
    if (searchName === 'band neutrophil' && refName === 'neutrophil (segmented or band)') return true

    return false
  })
}

const TUTORIAL_STEPS = [
  {
    title: 'Blast',
    content: (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative w-full h-64 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="relative w-full h-full aspect-square">
              <Image
                src="/images/cells/blast_000.png"
                alt="Blast cell"
                fill
                className="object-contain"
                unoptimized={true}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Blast</h3>
              <p className="text-muted-foreground mb-4">
                The earliest recognizable cell in hematopoietic lineages.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Nuclear Features:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Large nucleus with fine, open chromatin</li>
                  <li>Prominent nucleoli (1-2)</li>
                  <li>Round to oval shape</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium">Cytoplasmic Features:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Scant to moderate amount</li>
                  <li>Deeply basophilic (blue)</li>
                  <li>May contain azurophilic granules</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Promyelocyte',
    content: (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative w-full h-64 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="relative w-full h-full aspect-square">
              <Image
                src="/images/cells/promyelocyte_000.png"
                alt="Promyelocyte"
                fill
                className="object-contain"
                unoptimized={true}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Promyelocyte</h3>
              <p className="text-muted-foreground mb-4">
                Early neutrophil precursor with prominent primary granules.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Nuclear Features:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Large, round to oval nucleus</li>
                  <li>Fine chromatin pattern</li>
                  <li>Nucleoli may be visible</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium">Cytoplasmic Features:</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Abundant basophilic cytoplasm</li>
                  <li>Prominent azurophilic (primary) granules</li>
                  <li>Granules are large and dark</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Lymphocytes and Monocytes',
    content: (
      <div className="space-y-6">
        <p className="text-lg">
          Mononuclear cells with distinct morphological features and important immune functions.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="relative w-full h-full aspect-square">
                <Image
                  src="/images/cells/lymphocyte_000.png"
                  alt="Lymphocyte"
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Lymphocyte</h4>
              <p className="text-sm text-muted-foreground">
                Small cell with round, dense nucleus and scant blue cytoplasm. Includes T cells, B cells, and NK cells.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="relative w-full h-full aspect-square">
                <Image
                  src="/images/cells/monocyte_000.png"
                  alt="Monocyte"
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Monocyte</h4>
              <p className="text-sm text-muted-foreground">
                Large cell with kidney-shaped or indented nucleus and abundant gray-blue cytoplasm. Precursor to macrophages.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Erythroid Lineage',
    content: (
      <div className="space-y-6">
        <p className="text-lg">
          Red blood cell precursors show progressive nuclear condensation and cytoplasmic color changes during maturation.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="relative w-full h-full aspect-square">
                <Image
                  src="/images/cells/basophilic_erythroblast_000.png"
                  alt="Basophilic erythroblast"
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Basophilic Erythroblast</h4>
              <p className="text-sm text-muted-foreground">
                Early stage with deeply basophilic (blue) cytoplasm due to abundant ribosomes for hemoglobin synthesis.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-center p-4">
                <Microscope className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Image not available
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Polychromatic Erythroblast</h4>
              <p className="text-sm text-muted-foreground">
                Middle stage with mixed blue-pink cytoplasm as hemoglobin synthesis increases while ribosomes decrease.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Mature Granulocytes',
    content: (
      <div className="space-y-6">
        <p className="text-lg">
          Mature neutrophils and other granulocytes found in peripheral blood and bone marrow.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-center p-4">
                <Microscope className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Image not available
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Segmented Neutrophil</h4>
              <p className="text-sm text-muted-foreground">
                Mature neutrophil with segmented nucleus (2-5 lobes) connected by thin chromatin filaments and pale pink cytoplasm.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-center p-4">
                <Microscope className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Image not available
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Orthochromatic Erythroblast</h4>
              <p className="text-sm text-muted-foreground">
                Late stage erythroid precursor with pink cytoplasm from hemoglobin accumulation and small, condensed nucleus ready for extrusion.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Immature Cells and Blasts',
    content: (
      <div className="space-y-6">
        <p className="text-lg">
          Early precursor cells found primarily in bone marrow, with large nuclei and prominent nucleoli.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="relative w-full h-full aspect-square">
                <Image
                  src="/images/cells/blast_000.png"
                  alt="Blast cell"
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Blast Cell</h4>
              <p className="text-sm text-muted-foreground">
                Immature hematopoietic cell with large nucleus, fine chromatin, prominent nucleoli, and basophilic cytoplasm.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
              <div className="relative w-full h-full aspect-square">
                <Image
                  src="/images/cells/plasma_000.png"
                  alt="Plasma cell"
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Plasma Cell</h4>
              <p className="text-sm text-muted-foreground">
                Antibody-producing cell with eccentric nucleus, "clock-face" chromatin, and deeply basophilic cytoplasm.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 p-4 bg-primary/10 rounded-lg">
          <h4 className="font-semibold mb-2">Ready to Test Your Knowledge?</h4>
          <p className="text-sm text-muted-foreground">
            Now that you've learned about different cell types, try the interactive quiz to test your identification skills!
          </p>
        </div>
      </div>
    )
  }
]

export function CellQuizTutorial({ onComplete }: CellQuizTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const step = TUTORIAL_STEPS[currentStep]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Cell Type Guide</h1>
            <p className="text-lg text-muted-foreground">Learn about different hematologic cell types and their characteristics</p>
          </div>
        </div>
        <Button variant="outline" onClick={onComplete} size="lg">
          Back to Quiz
        </Button>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {TUTORIAL_STEPS.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content Card */}
      <Card className="shadow-lg">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Microscope className="h-6 w-6" />
            {step.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {step.content}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <Button onClick={handleNext} className="gap-2">
          {currentStep < TUTORIAL_STEPS.length - 1 ? (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Start Quiz
              <Target className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* References Section */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">References</h3>
        <div className="text-sm text-gray-600 leading-relaxed flex items-start space-x-2">
          <a
            href="https://doi.org/10.1007/s00277-020-04255-4"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors mt-0.5"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <span>
            Parmentier S, Kramer M, Weller S, Schuler U, Ordemann R, Rall G, et al. (2020).
            Reevaluation of reference values for bone marrow differential counts in 236 healthy bone marrow donors.
            <em> Ann Hematol</em>, 99(12), 2723-2729.
          </span>
        </div>
      </div>

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}
