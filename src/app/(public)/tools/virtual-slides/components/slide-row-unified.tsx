/**
 * Unified slide row component
 * Works with full slide data from unified search API
 */

import { VirtualSlide } from "@/shared/types/virtual-slides";
import { ExternalLink, Eye, Microscope } from "lucide-react";
import Image from "next/image";

// Repository color mapping
const REPOSITORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Hematopathology eTutorial": {
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
  },
  "Leeds University": {
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  "PathPresenter": {
    bg: "bg-green-100 dark:bg-green-950",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  "MGH Pathology": {
    bg: "bg-purple-100 dark:bg-purple-950",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  "University of Toronto LMP": {
    bg: "bg-orange-100 dark:bg-orange-950",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
  },
  "Rosai Collection": {
    bg: "bg-pink-100 dark:bg-pink-950",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-300 dark:border-pink-700",
  },
  "Recut Club": {
    bg: "bg-teal-100 dark:bg-teal-950",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-300 dark:border-teal-700",
  },
};

interface SlideRowUnifiedProps {
  slide: VirtualSlide;
  showDiagnoses: boolean;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  index?: number;
}

export function SlideRowUnified({
  slide,
  showDiagnoses,
  isRevealed = false,
  onToggleReveal,
}: SlideRowUnifiedProps) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      {/* Preview */}
      <td className="p-2 md:p-4">
        <div className="relative w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded overflow-hidden">
          {slide.preview_image_url ? (
            <Image
              src={slide.preview_image_url}
              alt={slide.diagnosis}
              fill
              className="object-cover"
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
                    {[slide.age, slide.gender].filter(Boolean).join(", ")}
                  </p>
                )}
                {slide.patient_info && (
                  <p className="text-xs text-gray-600">{slide.patient_info}</p>
                )}
                {slide.clinical_history && (
                  <p className="text-xs text-gray-600 italic">{slide.clinical_history}</p>
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
                        {[slide.age, slide.gender].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {slide.patient_info && (
                      <p className="text-xs text-gray-600">{slide.patient_info}</p>
                    )}
                    {slide.clinical_history && (
                      <p className="text-xs text-gray-600 italic">{slide.clinical_history}</p>
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
        {(() => {
          const colors = REPOSITORY_COLORS[slide.repository] || {
            bg: "bg-gray-100 dark:bg-gray-800",
            text: "text-gray-700 dark:text-gray-300",
            border: "border-gray-300 dark:border-gray-600",
          };
          const shortName = slide.repository
            .replace("Hematopathology eTutorial", "Heme eTutorial")
            .replace("University of Toronto LMP", "Toronto")
            .replace("Leeds University", "Leeds")
            .replace("MGH Pathology", "MGH")
            .replace("Rosai Collection", "Rosai");

          return (
            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
              {shortName}
            </span>
          );
        })()}
      </td>

      {/* Category */}
      <td className="p-2 md:p-4 hidden md:table-cell">
        <div className="space-y-1">
          <p className="text-sm text-gray-600">{slide.category}</p>
          {slide.subcategory && <p className="text-xs text-gray-500">{slide.subcategory}</p>}
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
          {slide.repository === "Hematopathology eTutorial" &&
            slide.other_urls &&
            slide.other_urls.length > 0 &&
            slide.other_urls[0] && (
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
  );
}
