// src/app/(public)/tools/virtual-slides/components/slide-row.tsx

import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ExternalLink, Microscope, Eye } from 'lucide-react'
import Image from 'next/image'
import { VirtualSlide } from '../types'



interface SlideRowProps {
  slide: VirtualSlide
  index: number
  showDiagnoses?: boolean
  isRevealed?: boolean
  onToggleReveal?: (slideId: string) => void
}

export function SlideRow({ slide, index, showDiagnoses = true, isRevealed = false, onToggleReveal }: SlideRowProps) {
  return (
    <tr key={`${slide.id}-${index}`} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
      {/* Preview Image */}
      <td className="p-4">
        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {slide.preview_image_url ? (
            <Image
              src={slide.preview_image_url}
              alt={slide.diagnosis}
              width={64}
              height={64}
              unoptimized
              className="object-cover w-full h-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={`flex items-center justify-center w-full h-full ${slide.preview_image_url ? 'hidden' : ''}`}>
            <Microscope className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </td>

      {/* Slide Info (Mobile) / Diagnosis (Mid) / Diagnosis (Desktop) */}
      <td className="p-4">
        <div className="space-y-1">
          {showDiagnoses && (
            <div className="space-y-1">
              <h3 className="font-medium text-sm leading-tight line-clamp-3">
                {slide.diagnosis}
              </h3>
              {/* Clinical information - always show when diagnoses are visible */}
              <div className="space-y-1">
                {(slide.age || slide.gender) && (
                  <p className="text-xs text-muted-foreground">
                    {[slide.age, slide.gender].filter(Boolean).join(', ')}
                  </p>
                )}
                {slide.patient_info && (
                  <p className="text-xs text-muted-foreground">
                    {slide.patient_info}
                  </p>
                )}
                {slide.clinical_history && (
                  <p className="text-xs text-muted-foreground italic">
                    {slide.clinical_history}
                  </p>
                )}
              </div>
            </div>
          )}
          {!showDiagnoses && (
            <div className="font-medium text-sm leading-tight">
              {isRevealed ? (
                <div className="space-y-1">
                  <div className="text-foreground line-clamp-3">{slide.diagnosis}</div>
                  {/* Clinical information - show when revealed */}
                  <div className="space-y-1 mt-1">
                    {(slide.age || slide.gender) && (
                      <p className="text-xs text-muted-foreground">
                        {[slide.age, slide.gender].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {slide.patient_info && (
                      <p className="text-xs text-muted-foreground">
                        {slide.patient_info}
                      </p>
                    )}
                    {slide.clinical_history && (
                      <p className="text-xs text-muted-foreground italic">
                        {slide.clinical_history}
                      </p>
                    )}
                  </div>
                  {/* Hide button positioned below diagnosis and clinical info */}
                  <button
                    onClick={() => onToggleReveal?.(slide.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-2"
                    title="Hide diagnosis and clinical information"
                  >
                    <Eye className="h-3 w-3" />
                    Hide
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onToggleReveal?.(slide.id)}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                >
                  <Eye className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  <span className="underline decoration-dotted underline-offset-2">
                    Click to show
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Mobile: Show category/subcategory and repository in simple text */}
          <div className="md:hidden space-y-1">
            <div className="text-xs text-muted-foreground">
              {slide.category}
              {slide.subcategory && slide.subcategory !== slide.category && (
                <span> • {slide.subcategory}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {slide.repository}
            </div>
          </div>

          {/* Mid form (md-lg): Show repository as simple text */}
          <div className="hidden md:block lg:hidden">
            <div className="text-xs text-muted-foreground">
              {slide.repository}
            </div>
          </div>


        </div>
      </td>

      {/* Repository - Desktop only (lg+) */}
      <td className="p-4 hidden lg:table-cell">
        <Badge variant="outline" className="text-xs">
          {slide.repository}
        </Badge>
      </td>

      {/* Category - Desktop only */}
      <td className="p-4 hidden md:table-cell">
        <div className="space-y-1">
          <p className="text-sm font-medium">{slide.category}</p>
          {slide.subcategory && slide.subcategory !== slide.category && (
            <p className="text-xs text-muted-foreground">{slide.subcategory}</p>
          )}
        </div>
      </td>

      {/* Details - Desktop only (lg+) */}
      <td className="p-4 hidden lg:table-cell">
        <div className="space-y-1">
          {slide.stain_type && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{slide.stain_type}</span>
            </div>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="p-4">
        <div className="flex gap-2">
          {/* Mobile: Single icon */}
          {slide.slide_url && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="p-2 md:hidden"
              title="View Virtual Slide"
            >
              <a
                href={slide.slide_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {/* Mid form (md-lg): Abbreviated buttons */}
          <div className="hidden md:flex lg:hidden gap-2">
            {slide.slide_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.slide_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  WSI
                </a>
              </Button>
            )}

            {/* Repository-specific second button - abbreviated */}
            {slide.repository === 'Leeds University' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Case
                </a>
              </Button>
            )}

            {slide.repository === 'University of Toronto LMP' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Case
                </a>
              </Button>
            )}

            {slide.repository === 'Hematopathology eTutorial' && slide.other_urls && slide.other_urls.length > 0 && slide.other_urls[0] && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.other_urls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Notes
                </a>
              </Button>
            )}

            {slide.repository === 'Rosai Collection' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Info
                </a>
              </Button>
            )}
          </div>

          {/* Desktop (lg+): Full buttons */}
          <div className="hidden lg:flex gap-2">
            {slide.slide_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.slide_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Slide
                </a>
              </Button>
            )}

            {/* Repository-specific second button */}
            {slide.repository === 'Leeds University' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Case
                </a>
              </Button>
            )}

            {slide.repository === 'University of Toronto LMP' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Case
                </a>
              </Button>
            )}

            {slide.repository === 'Hematopathology eTutorial' && slide.other_urls && slide.other_urls.length > 0 && slide.other_urls[0] && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.other_urls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Study Notes
                </a>
              </Button>
            )}

            {slide.repository === 'Rosai Collection' && slide.case_url && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-xs"
              >
                <a
                  href={slide.case_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Seminar Info
                </a>
              </Button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
