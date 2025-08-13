/**
 * Unified slide row component
 * Works with full slide data from unified search API
 */

import { VirtualSlide } from '@/shared/types/virtual-slides'
import { ExternalLink, Eye, Info, Microscope } from 'lucide-react'

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
      <td className="p-4">
        <div className="relative w-16 h-16 bg-gray-100 rounded overflow-hidden">
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
      <td className="p-4">
        <div className="space-y-1">
          {showDiagnoses ? (
            <>
              <h3 className="font-medium text-gray-900 leading-tight">
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
                  <h3 className="font-medium text-gray-900 leading-tight">
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
      <td className="p-4 hidden lg:table-cell">
        <span className="text-sm text-gray-600">{slide.repository}</span>
      </td>

      {/* Category */}
      <td className="p-4 hidden md:table-cell">
        <div className="space-y-1">
          <p className="text-sm text-gray-600">{slide.category}</p>
          {slide.subcategory && (
            <p className="text-xs text-gray-500">{slide.subcategory}</p>
          )}
        </div>
      </td>

      {/* Details */}
      <td className="p-4 hidden lg:table-cell">
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
      <td className="p-4">
        <div className="flex gap-2">
          {slide.slide_url && (
            <a
              href={slide.slide_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View Slide
            </a>
          )}
          {slide.case_url && (
            <a
              href={slide.case_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Info className="w-3 h-3" />
              Case
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}
