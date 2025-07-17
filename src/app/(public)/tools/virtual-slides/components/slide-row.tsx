// src/app/(public)/tools/virtual-slides/components/slide-row.tsx

import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ExternalLink, Microscope, Eye } from 'lucide-react'
import Image from 'next/image'
import { VirtualSlide } from '../types'

interface SlideRowProps {
  slide: VirtualSlide
  index: number
}

export function SlideRow({ slide, index }: SlideRowProps) {
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

      {/* Diagnosis & Patient Info */}
      <td className="p-4">
        <div className="space-y-1">
          <h3 className="font-medium text-sm leading-tight line-clamp-3">
            {slide.diagnosis}
          </h3>
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
      </td>

      {/* Repository */}
      <td className="p-4">
        <Badge variant="outline" className="text-xs">
          {slide.repository}
        </Badge>
      </td>

      {/* Category */}
      <td className="p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{slide.category}</p>
          {slide.subcategory && slide.subcategory !== slide.category && (
            <p className="text-xs text-muted-foreground">{slide.subcategory}</p>
          )}
        </div>
      </td>

      {/* Details */}
      <td className="p-4">
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
      </td>
    </tr>
  )
}
