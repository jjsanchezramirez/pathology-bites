/**
 * Unified slide row component
 * Works with full slide data from unified search API
 */

import { memo, useState } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { ExternalLink, Eye, Microscope, Layers, ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import { getR2PublicUrl } from "@/shared/services/r2-storage";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import { getVirtualSlideCategoryInfo } from "../utils/virtual-slides-category-map";

// Repository logo mapping. Points at the optimized 240×176 assets
// (logos/optimized/*) — see `optimize-repo-logos.ts` for the pipeline.
const REPOSITORY_LOGOS: Record<string, string> = {
  "Hematopathology eTutorial": "logos/optimized/hematopathology-etutorial-logo.png",
  "Leeds University": "logos/optimized/university-of-leeds-logo.png",
  PathPresenter: "logos/optimized/path-presenter-logo.png",
  "MGH Pathology": "logos/optimized/mgh-logo.png",
  "Rosai Collection": "logos/optimized/rosai-collection-logo.png",
  "Recut Club": "logos/optimized/recut-club-logo.png",
  "St. Jude Cloud": "logos/optimized/st-jude-logo.png",
  "WHO Blue Books Online": "logos/optimized/who-logo.png",
  "AANP Diagnostic Slide Session": "logos/optimized/aanp-logo.png",
  "Wirtualny Mikroskop": "logos/optimized/mostwiedzy-logo.png",
};

// Clinical info block — dedupes patient_info against the age/sex line (the corpus
// sometimes carries the same "56, F" in both) and clamps each field independently.
function ClinicalInfo({ slide }: { slide: VirtualSlide }) {
  const ageSex = [slide.age, slide.gender].filter(Boolean).join(", ");
  const showPatientInfo = slide.patient_info && slide.patient_info.trim() !== ageSex;
  return (
    <div className="space-y-1">
      {ageSex && <p className="text-xs text-gray-600">{ageSex}</p>}
      {showPatientInfo && <p className="text-xs text-gray-600 line-clamp-1">{slide.patient_info}</p>}
      {slide.clinical_history && (
        <p className="text-xs text-gray-600 italic line-clamp-3">{slide.clinical_history}</p>
      )}
    </div>
  );
}

// Related-slides label. Conference/seminar repositories group by event, not by a single
// case, so they read as "from this conference" rather than "related slides".
function relatedLabel(repository: string, n: number): string {
  // Session/conference sources group DISTINCT cases (not same-case stains) — label them so
  // they don't read as "related slides". MGH groups by teaching session (e.g. WSI21-111 →
  // Case-1/2/3 are different cases). Rosai = seminar, Recut = conference.
  if (repository === "Rosai Collection") return `${n} from this seminar`;
  if (repository === "Recut Club") return `${n} from this conference`;
  if (repository === "MGH Pathology") return `${n} from this session`;
  return `${n} related slide${n > 1 ? "s" : ""}`;
}

interface SlideRowUnifiedProps {
  slide: VirtualSlide;
  showDiagnoses: boolean;
  isRevealed?: boolean;
  onToggleReveal?: () => void;
  index?: number;
  // Related slides (same pair/panel case-group), resolved by the page.
  related?: VirtualSlide[];
  // Open this slide in the in-house OSD viewer (prototype). Provided by the page.
  onOpenViewer?: () => void;
}

export const SlideRowUnified = memo(function SlideRowUnified({
  slide,
  showDiagnoses,
  isRevealed = false,
  onToggleReveal,
  related = [],
  onOpenViewer,
}: SlideRowUnifiedProps) {
  const logoPath = REPOSITORY_LOGOS[slide.repository];
  const categoryInfo = getVirtualSlideCategoryInfo(slide.category);
  const [relatedOpen, setRelatedOpen] = useState(false);

  return (
    <>
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
              <h3 className="font-medium text-gray-900 leading-tight text-sm md:text-base line-clamp-2">
                {slide.diagnosis}
              </h3>
              <ClinicalInfo slide={slide} />
            </>
          ) : (
            <>
              {isRevealed ? (
                <>
                  <h3 className="font-medium text-gray-900 leading-tight text-sm md:text-base line-clamp-2">
                    {slide.diagnosis}
                  </h3>
                  <ClinicalInfo slide={slide} />
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

          {/* Badges: category (color) · organ (gray) · stain (violet) — replaces the Site column */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span
              className="inline-flex items-center rounded border px-1.5 py-0 text-[11px] font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${categoryInfo.color} 20%, white)`,
                color: `color-mix(in srgb, ${categoryInfo.color} 90%, black)`,
                borderColor: `color-mix(in srgb, ${categoryInfo.color} 30%, white)`,
              }}
            >
              {categoryInfo.shortForm}
            </span>
            {slide.subcategory && (
              <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0 text-[11px] font-medium text-gray-700">
                {slide.subcategory}
              </span>
            )}
            {slide.stain_type && (
              <span className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-0 text-[11px] font-medium text-violet-700">
                {slide.stain_type}
              </span>
            )}
          </div>

          {/* Related slides (same case — pair/panel) */}
          {related.length > 0 && (
            <button
              onClick={() => setRelatedOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {relatedOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <Layers className="w-3.5 h-3.5" />
              {relatedLabel(slide.repository, related.length)}
            </button>
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
          {onOpenViewer && isViewerSupported(slide.repository) && (
            <button
              onClick={onOpenViewer}
              aria-label="Open in our viewer"
              className="inline-flex items-center justify-center rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors p-2 md:px-3 md:py-1.5 text-xs font-medium"
            >
              <Microscope className="w-4 h-4 md:mr-1.5" />
              <span className="hidden md:inline">Open viewer</span>
            </button>
          )}
          {/* Login-walled pages (per-case, mostly MGH): tiles are public but the external
              page needs login, so we hide the link and route through the in-house viewer. */}
          {slide.slide_url && !slide.loginWalled && (
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

    {/* Expanded related-slides panel — siblings of the same case (pair/panel). */}
    {relatedOpen && related.length > 0 && (
      <tr className="bg-gray-50/70 border-b border-gray-200">
        <td colSpan={4} className="p-2 md:p-4">
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <a
                key={r.id}
                href={r.slide_url || r.case_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-40 flex-col overflow-hidden rounded-md border border-gray-200 bg-white hover:border-primary hover:shadow-sm transition"
              >
                <div className="relative h-20 w-full bg-gray-100">
                  {r.preview_image_url ? (
                    <Image
                      src={r.preview_image_url}
                      alt={r.diagnosis}
                      fill
                      className="object-cover"
                      loading="lazy"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Microscope className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  <p className="truncate text-xs font-medium text-gray-800 group-hover:text-primary">
                    {showDiagnoses || isRevealed ? r.diagnosis : "Slide"}
                  </p>
                  {r.stain_type && (
                    <p className="truncate text-[10px] text-gray-500">{r.stain_type}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </td>
      </tr>
    )}
    </>
  );
});
