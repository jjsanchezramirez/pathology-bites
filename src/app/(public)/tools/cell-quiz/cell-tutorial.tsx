"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import {
  BloodCellsReferenceData,
  CellQuizImagesData,
  BloodCellReference,
} from "@/shared/hooks/use-client-cell-quiz";
import { log } from "@/shared/utils/logging";

export function CellTutorial({
  onBack,
  bloodCellsReference,
  cellData,
}: {
  onBack: () => void;
  bloodCellsReference: BloodCellsReferenceData | null;
  cellData: CellQuizImagesData | null;
}) {
  const [currentCellIndex, setCurrentCellIndex] = useState(0);

  // Get current cell data for image cache handler
  const currentReferenceCell = bloodCellsReference?.cells?.[currentCellIndex];

  // Find matching cell data using the same logic as below
  const matchingCellDataEntry = currentReferenceCell
    ? Object.entries(cellData || {}).find(([cellKey, cellValue]) => {
        const normalizedRefName = currentReferenceCell.name.toLowerCase().replace(/\s+/g, "_");
        const cellValueName = cellValue?.name?.toLowerCase();
        const refCellName = currentReferenceCell.name.toLowerCase();
        return cellKey === normalizedRefName || cellValueName === refCellName;
      })
    : null;

  const currentImageSrc = matchingCellDataEntry ? matchingCellDataEntry[1]?.images?.[0] || "" : "";

  // ✅ Fix: Call useImageCacheHandler at top level to avoid hook rule violations
  const handleTutorialImageLoad = useImageCacheHandler(currentImageSrc, true);

  // Debug logging
  log.debug("🔍 Tutorial Debug Info:", {
    bloodCellsReference: {
      exists: !!bloodCellsReference,
      hasCells: !!bloodCellsReference?.cells,
      cellCount: bloodCellsReference?.cells?.length || 0,
      sampleCellNames:
        bloodCellsReference?.cells?.slice(0, 5)?.map((c: BloodCellReference) => c.name) || [],
    },
    cellData: {
      exists: !!cellData,
      cellCount: cellData ? Object.keys(cellData).length : 0,
      sampleKeys: cellData ? Object.keys(cellData).slice(0, 5) : [],
    },
  });

  // Keyboard navigation for tutorial mode (desktop only) - must be before early returns
  useEffect(() => {
    if (!bloodCellsReference?.cells) return; // Don't set up keyboard handling if no data

    // Check if we're on a mobile device (screen width < 768px)
    const isMobile = () => window.innerWidth < 768;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip keyboard handling on mobile devices
      if (isMobile()) return;

      // Prevent default behavior for our handled keys
      if (["ArrowLeft", "ArrowRight", "Space", "Enter"].includes(event.code)) {
        event.preventDefault();
      }

      // Arrow keys for navigation
      if (event.code === "ArrowRight" || event.code === "Space" || event.code === "Enter") {
        if (currentCellIndex < bloodCellsReference.cells.length - 1) {
          setCurrentCellIndex((prev) => prev + 1);
        }
        return;
      }

      if (event.code === "ArrowLeft") {
        if (currentCellIndex > 0) {
          setCurrentCellIndex((prev) => prev - 1);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentCellIndex, bloodCellsReference?.cells]);

  if (!bloodCellsReference?.cells) {
    log.error("❌ No reference cells data available in tutorial");
    return (
      <div className="flex min-h-screen flex-col">
        <section className="relative py-8">
          <div className="container px-4 max-w-5xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Loading Tutorial...</h2>
              <p className="text-muted-foreground">
                Please wait while we load the cell reference data.
              </p>
              <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                Back to Menu
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const referenceCells = bloodCellsReference.cells;
  // currentReferenceCell is already declared above for image cache handler

  log.debug("📋 Current cell data:", {
    index: currentCellIndex,
    cell: currentReferenceCell,
    hasDetailedFields: !!(
      currentReferenceCell?.size ||
      currentReferenceCell?.lineage ||
      currentReferenceCell?.key_features
    ),
  });

  // Find matching cell data for images by converting names to match the cellData keys
  const matchingCellData = Object.entries(cellData || {}).find(([cellKey, cellValue]) => {
    // Convert reference cell name to match cellData key format (lowercase, underscores)
    const normalizedRefName = currentReferenceCell.name.toLowerCase().replace(/\s+/g, "_");
    // Also check if the cellValue name matches (case insensitive)
    const cellValueName = cellValue?.name?.toLowerCase();
    const refCellName = currentReferenceCell.name.toLowerCase();

    const keyMatch = cellKey === normalizedRefName;
    const nameMatch = cellValueName === refCellName;
    const isMatch = keyMatch || nameMatch;

    // Debug logging for tutorial image matching
    if (process.env.NODE_ENV === "development") {
      log.debug(`🖼️ Tutorial image matching "${currentReferenceCell.name}":`);
      log.debug(`   - Looking for key: "${normalizedRefName}" in cellData`);
      log.debug(`   - Checking cellKey: "${cellKey}" = ${keyMatch}`);
      log.debug(
        `   - Checking cellValue.name: "${cellValueName}" vs "${refCellName}" = ${nameMatch}`
      );
      log.debug(`   - Final match: ${isMatch}`);
    }

    return isMatch;
  })?.[1];

  // Debug log if no matching cell data found
  if (!matchingCellData && process.env.NODE_ENV === "development") {
    log.warn(`⚠️ No image data found for tutorial cell: "${currentReferenceCell.name}"`);
    log.debug("Available cellData keys:", Object.keys(cellData || {}));
  }

  const handleNext = () => {
    if (currentCellIndex < bloodCellsReference.cells.length - 1) {
      setCurrentCellIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentCellIndex > 0) {
      setCurrentCellIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Type Tutorial"
        description={`Learn about different blood cell types with detailed descriptions and characteristics. Cell ${currentCellIndex + 1} of ${referenceCells.length}`}
      />

      {/* Tutorial Content */}
      <section className="relative py-8">
        <div className="container px-4 max-w-5xl mx-auto">
          <Card className="p-4 md:p-8 shadow-lg">
            <CardContent className="space-y-4 md:space-y-6">
              {/* Header Navigation */}
              <div className="flex justify-between items-center">
                <div className="text-xs md:text-sm text-muted-foreground">
                  {currentCellIndex + 1} of {referenceCells.length} cells
                </div>
                <Button variant="outline" onClick={onBack} size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </div>

              {/* Cell Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                {/* Image - Smaller area */}
                <div className="flex justify-center">
                  {matchingCellData &&
                  matchingCellData.images &&
                  matchingCellData.images.length > 0 ? (
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
                      <Image
                        src={matchingCellData.images[0]}
                        alt={currentReferenceCell.name}
                        fill
                        className="object-contain"
                        unoptimized={true}
                        onLoad={handleTutorialImageLoad}
                      />
                    </div>
                  ) : (
                    <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg border bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No image available</span>
                    </div>
                  )}
                </div>

                {/* Information - Larger area (2 columns) */}
                <div className="md:col-span-2 space-y-3 md:space-y-4">
                  <h2 className="text-2xl md:text-3xl font-bold">
                    {currentReferenceCell?.name || "Unknown Cell"}
                  </h2>

                  <div className="space-y-2 md:space-y-3">
                    {/* Size, N:C Ratio, and Normal Range - responsive layout */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs md:text-sm">
                      {currentReferenceCell?.size && (
                        <div>
                          <span className="font-semibold text-muted-foreground">Size:</span>{" "}
                          {currentReferenceCell.size}
                        </div>
                      )}
                      {currentReferenceCell?.nc_ratio && (
                        <div>
                          <span className="font-semibold text-muted-foreground">N:C Ratio:</span>{" "}
                          {currentReferenceCell.nc_ratio}
                        </div>
                      )}
                      {currentReferenceCell?.normal_percentage && (
                        <div>
                          <span className="font-semibold text-muted-foreground">Normal Range:</span>{" "}
                          {currentReferenceCell.normal_percentage}
                        </div>
                      )}
                    </div>

                    {/* Key Features */}
                    {currentReferenceCell?.key_features && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Key Features
                        </h3>
                        <p className="text-sm">{currentReferenceCell.key_features}</p>
                      </div>
                    )}

                    {/* Nucleus */}
                    {currentReferenceCell?.nucleus && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Nucleus
                        </h3>
                        <p className="text-sm">{currentReferenceCell.nucleus}</p>
                      </div>
                    )}

                    {/* Normal Percentage (if not shown above) */}
                    {currentReferenceCell?.normal_percentage &&
                      !currentReferenceCell?.size &&
                      !currentReferenceCell?.nc_ratio && (
                        <div>
                          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                            Normal Percentage
                          </h3>
                          <p className="text-sm">{currentReferenceCell.normal_percentage}</p>
                        </div>
                      )}

                    {/* Clinical Significance */}
                    {currentReferenceCell?.clinical_significance && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Clinical Significance
                        </h3>
                        <p className="text-sm">{currentReferenceCell.clinical_significance}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {currentReferenceCell?.notes && (
                      <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Notes
                        </h3>
                        <p className="text-sm">{currentReferenceCell.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Buttons */}
              <div className="flex justify-between items-center pt-4 gap-2 md:hidden">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentCellIndex === 0}
                  className="flex-1 sm:flex-none"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={currentCellIndex === referenceCells.length - 1}
                  className="flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Keyboard Instructions - Desktop only */}
              <div className="border-t pt-6 mt-4 hidden md:block">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    <strong>Keyboard shortcuts:</strong> Press{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Space
                    </kbd>{" "}
                    or{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Enter
                    </kbd>{" "}
                    or{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ◀
                    </kbd>{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ▶
                    </kbd>{" "}
                    to navigate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* References Section */}
          <div className="mt-6 md:mt-8 pt-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">References</h3>
            <div className="text-xs md:text-sm text-gray-600 leading-relaxed flex items-start space-x-2">
              <a
                href="https://doi.org/10.1007/s00277-020-04255-4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors mt-0.5 flex-shrink-0"
              >
                <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
              </a>
              <span className="break-words">
                Parmentier S, Kramer M, Weller S, Schuler U, Ordemann R, Rall G, et al. (2020).
                Reevaluation of reference values for bone marrow differential counts in 236 healthy
                bone marrow donors.
                <em> Ann Hematol</em>, 99(12), 2723-2729.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
    </div>
  );
}
