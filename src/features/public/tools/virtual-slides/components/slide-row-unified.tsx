/**
 * Unified slide row component
 * Works with full slide data from unified search API
 */

import { memo } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { ExternalLink, Eye, Microscope } from "lucide-react";
import Image from "next/image";
import { getR2PublicUrl } from "@/shared/services/r2-storage";
import { getVirtualSlideCategoryInfo } from "../utils/virtual-slides-category-map";

// Repository logo mapping
const REPOSITORY_LOGOS: Record<string, string> = {
  "Hematopathology eTutorial": "logos/hematopathology-etutorial-logo.png",
  "Leeds University": "logos/university-of-leeds-logo.png",
  PathPresenter: "logos/path-presenter-logo.png",
  "MGH Pathology": "logos/mgh-logo.png",
  "University of Toronto LMP": "logos/university-of-toronto-logo.png",
  "Rosai Collection": "logos/rosai-collection-logo.png",
  "Recut Club": "logos/recut-club-logo.png",
  "St. Jude Cloud": "logos/st-jude-logo.png",
};

interface SlideRowUnifiedProps {
  slide: VirtualSlide;
  showDiagnoses: boolean;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  index?: number;
}

export const SlideRowUnified = memo(function SlideRowUnified({
  slide,
  showDiagnoses,
  isRevealed = false,
  onToggleReveal,
}: SlideRowUnifiedProps) {
  const logoPath = REPOSITORY_LOGOS[slide.repository];
  const categoryInfo = getVirtualSlideCategoryInfo(slide.category);

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      {/* Preview */}
      <td className="p-2 md:p-4 w-20 md:w-24">
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

      {/* Diagnosis and Clinical Information */}
      <td className="p-2 md:p-4">
        <div className="space-y-2">
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
                <>
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
                </>
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

          {/* Site badges (Category + Organ) - visible on mobile/tablet only (inline in diagnosis column) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 lg:hidden">
            {/* Category - Color-coded */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
              style={{
                backgroundColor: `color-mix(in srgb, ${categoryInfo.color} 20%, white)`,
                color: `color-mix(in srgb, ${categoryInfo.color} 90%, black)`,
                borderColor: `color-mix(in srgb, ${categoryInfo.color} 30%, white)`,
              }}
            >
              {categoryInfo.shortForm}
            </span>

            {/* Subcategory (Organ System) - Light gray */}
            {slide.subcategory && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                {slide.subcategory}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Site column (Category + Organ) - visible on desktop (lg+) */}
      <td className="p-2 md:p-4 w-32 md:w-40 hidden lg:table-cell">
        <div className="flex flex-col gap-1.5">
          {/* Category - Color-coded */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border w-fit"
            style={{
              backgroundColor: `color-mix(in srgb, ${categoryInfo.color} 20%, white)`,
              color: `color-mix(in srgb, ${categoryInfo.color} 90%, black)`,
              borderColor: `color-mix(in srgb, ${categoryInfo.color} 30%, white)`,
            }}
          >
            {categoryInfo.shortForm}
          </span>

          {/* Subcategory (Organ System) - Light gray */}
          {slide.subcategory && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 w-fit">
              {slide.subcategory}
            </span>
          )}
        </div>
      </td>

      {/* Repository - hidden on mobile, visible on tablet+ */}
      <td className="p-2 md:p-4 w-20 md:w-32 hidden md:table-cell">
        {logoPath ? (
          <div className="flex items-center justify-center h-8">
            <Image
              src={getR2PublicUrl(logoPath)}
              alt={slide.repository}
              width={80}
              height={32}
              unoptimized
              className="object-contain opacity-70 hover:opacity-100 transition-opacity"
            />
          </div>
        ) : (
          <span className="text-xs text-gray-600">{slide.repository}</span>
        )}
      </td>

      {/* Actions */}
      <td className="p-2 md:p-4 w-16 md:w-40">
        <div className="flex flex-col gap-2">
          {slide.slide_url && (
            <a
              href={slide.slide_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Slide"
              className="inline-flex items-center justify-center rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors p-2 md:px-3 md:py-1.5 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4 md:mr-1.5" />
              <span className="hidden md:inline">View Slide</span>
            </a>
          )}
          {slide.other_urls && slide.other_urls.length > 0 && slide.other_urls[0] && (
            <a
              href={slide.other_urls[0]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                slide.repository === "Hematopathology eTutorial"
                  ? "Study Notes"
                  : slide.repository === "Rosai Collection"
                    ? "Case Details"
                    : slide.repository === "University of Toronto LMP"
                      ? "Details"
                      : "More Info"
              }
              className="inline-flex items-center justify-center rounded-md text-foreground bg-background border border-border hover:bg-muted transition-colors p-2 md:px-3 md:py-1.5 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4 md:mr-1.5" />
              <span className="hidden md:inline">
                {slide.repository === "Hematopathology eTutorial"
                  ? "Study Notes"
                  : slide.repository === "Rosai Collection"
                    ? "Case Details"
                    : slide.repository === "University of Toronto LMP"
                      ? "Details"
                      : "More Info"}
              </span>
            </a>
          )}
        </div>
      </td>
    </tr>
  );
});
