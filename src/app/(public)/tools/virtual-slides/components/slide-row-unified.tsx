/**
 * Unified slide row component
 * Works with full slide data from unified search API
 */

import { VirtualSlide } from '@/shared/types/virtual-slides'
import { ExternalLink, Eye, Microscope } from 'lucide-react'

interface SlideRowUnifiedProps {
  slide: VirtualSlide
  index: number
  showDiagnoses: boolean
  isRevealed?: boolean
  onToggleReveal?: () => void
}

export function SlideRowUnified({ 
  slide, 
  index, 
  showDiagnoses,
  isRevealed = false,
  onToggleReveal
}: SlideRowUnifiedProps) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      {/* Preview */}
      <td className="p-2 md:p-4">
        <div className="relative w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded overflow-hidden">
          {slide.preview_image_url ? (
            <img
              src={slide.preview_image_url}
              alt={slide.diagnosis}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Microscope className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
      </td>

      {/* Diagnosis and Clinical Info */}
      <td className="p-2 md:p-4">
        <div className="space-y-1">
          {showDiagnoses ? (
            <>
              <h3 className="font-medium text-gray-900 leading-tight text-sm md:text-base">
                {slide.diagnosis}
              </h3>
              {/* Clinical information */}
              <div className="space-y-1">
                {(slide.age || slide.gender) && (
                  <p className="text-xs text-gray-600">
                    {[slide.age, slide.gender].filter(Boolean).join(', ')}
                  </p>
                )}
                {slide.patient_info && (
                  <p className="text-xs text-gray-600">
                    {slide.patient_info}
                  </p>
                )}
                {slide.clinical_history && (
                  <p className="text-xs text-gray-600 italic">
                    {slide.clinical_history}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {isRevealed ? (
                <div className="space-y-1">
                  <h3 className="font-medium text-gray-900 leading-tight text-sm md:text-base">
                    {slide.diagnosis}
                  </h3>
                  {/* Clinical information when revealed */}
                  <div className="space-y-1">
                    {(slide.age || slide.gender) && (
                      <p className="text-xs text-gray-600">
                        {[slide.age, slide.gender].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {slide.patient_info && (
                      <p className="text-xs text-gray-600">
                        {slide.patient_info}
                      </p>
                    )}
                    {slide.clinical_history && (
                      <p className="text-xs text-gray-600 italic">
                        {slide.clinical_history}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={onToggleReveal}
                  className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                >
                  <Eye className="w-4 h-4" />
                  Click to show
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Repository */}
      <td className="p-2 md:p-4 hidden lg:table-cell">
        <span className="text-sm text-gray-600">{slide.repository}</span>
      </td>

      {/* Category */}
      <td className="p-2 md:p-4 hidden md:table-cell">
        <div className="space-y-1">
          <p className="text-sm text-gray-600">{slide.category}</p>
          {slide.subcategory && (
            <p className="text-xs text-gray-500">{slide.subcategory}</p>
          )}
        </div>
      </td>

      {/* Details */}
      <td className="p-2 md:p-4 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          {slide.stain_type && (
            <>
              <Microscope className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600">{slide.stain_type}</span>
            </>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="p-2 md:p-4">
        <div className="flex gap-2">
          {slide.slide_url && (
            <a
              href={slide.slide_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Slide"
              className="inline-flex items-center justify-center rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors p-2 md:px-3 md:py-1 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden md:inline ml-1">View Slide</span>
            </a>
          )}
          {slide.repository === 'Hematopathology eTutorial' && slide.other_urls && slide.other_urls.length > 0 && slide.other_urls[0] && (
            <a
              href={slide.other_urls[0]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Study Notes"
              className="inline-flex items-center justify-center rounded-md text-foreground bg-background border border-border hover:bg-muted transition-colors p-2 md:px-3 md:py-1 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden md:inline ml-1">Study Notes</span>
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}
