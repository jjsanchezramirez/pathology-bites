"use client";

import { useState, useEffect, useMemo } from "react";
import { useSmartABPath } from "@/shared/hooks/use-smart-abpath";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { BookOpen, BookText } from "lucide-react";
import { ABPathPDFGenerator } from "@/features/public/tools/abpath/utils/pdf-generator";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { log } from "@/shared/utils/logging";
import { applyDesignationFilter, buildCategories, computeStats } from "./abpath-utils";
import { ABPathSkeleton } from "./abpath-skeleton";
import { ABPathControls } from "./abpath-controls";
import { ABPathStatsCard } from "./abpath-stats";
import { ABPathSectionCard } from "./abpath-section-card";
import { ABPathPagination } from "./abpath-pagination";

const HERO_DESCRIPTION =
  "Interactive ABPath content specifications with filtering by section, category, and designation.";

export default function ABPathContentPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Toggle states for sections and designations
  const [showAP, setShowAP] = useState(true);
  const [showCP, setShowCP] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showAR, setShowAR] = useState(true);
  const [showF, setShowF] = useState(true);

  // Use smart loading hook
  const {
    sections: paginatedSections,
    allSections,
    filteredSections,
    metadata,
    pagination,
    isLoading: loading,
    error: loadingError,
    actions,
    strategy,
  } = useSmartABPath({
    search: debouncedSearchTerm || undefined,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    showAP,
    showCP,
    sectionsPerPage: 7,
  });

  const toggles = useMemo(() => ({ showC, showAR, showF }), [showC, showAR, showF]);

  // Create data structure
  const data = useMemo(() => {
    if (!metadata) return null;
    return {
      content_specifications: {
        ap_sections: paginatedSections.filter((s) => s.type === "ap"),
        cp_sections: paginatedSections.filter((s) => s.type === "cp"),
      },
      metadata,
    };
  }, [paginatedSections, metadata]);

  // Debounce search term to reduce processing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Smart pagination handler
  const handlePageChange = (page: number) => {
    actions.loadPage(page);
  };

  // Categories from ALL sections (not just paginated) so the dropdown is complete
  const categories = useMemo(() => buildCategories(allSections), [allSections]);

  // Client-side designation filtering (C, AR, F) for the current page
  const filteredData = useMemo(
    () => applyDesignationFilter(paginatedSections, toggles),
    [paginatedSections, toggles]
  );

  // Coverage statistics
  const stats = useMemo(
    () => computeStats(allSections, filteredSections, toggles),
    [allSections, filteredSections, toggles]
  );

  // PDF-specific filtered data that includes ALL sections (not just current page)
  const pdfFilteredData = useMemo(
    () => applyDesignationFilter(filteredSections, toggles),
    [filteredSections, toggles]
  );

  // PDF generation function
  const generatePDF = async () => {
    if (!data) return;

    const generator = new ABPathPDFGenerator();
    const timestamp = new Date().toISOString().split("T")[0];

    // Determine filter suffix for filename
    let filterSuffix = "";
    if (!showAP && showCP) filterSuffix += "CP";
    else if (showAP && !showCP) filterSuffix += "AP";

    if (selectedCategory !== "all") {
      const categoryInfo = categories.find((c) => c.value === selectedCategory);
      if (categoryInfo) {
        filterSuffix +=
          (filterSuffix ? "_" : "") +
          categoryInfo.title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10);
      }
    }

    const designations = [];
    if (showC) designations.push("C");
    if (showAR) designations.push("AR");
    if (showF) designations.push("F");
    if (designations.length < 3) filterSuffix += (filterSuffix ? "_" : "") + designations.join("");

    if (searchTerm) filterSuffix += (filterSuffix ? "_" : "") + "filtered";

    try {
      // Use pdfFilteredData which includes ALL sections, not just current page
      const pdf = await generator.generatePDF(pdfFilteredData, {
        searchTerm,
        selectedType: showAP && showCP ? "all" : showAP ? "ap" : "cp",
        selectedDesignation: designations.length === 3 ? "all" : designations.join(","),
        stats,
      });

      const filename = `abpath-content_${timestamp}${filterSuffix ? "_" + filterSuffix : ""}.pdf`;
      pdf.save(filename);
    } catch (error) {
      log.error("Error generating PDF:", error);
    }
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("all");
    setShowAP(true);
    setShowCP(true);
    setShowC(true);
    setShowAR(true);
    setShowF(true);
  };

  const hasActiveFilters =
    !!searchTerm || selectedCategory !== "all" || !showAP || !showCP || !showC || !showAR || !showF;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero title="ABPath Content Specifications" description={HERO_DESCRIPTION} />
        <ABPathSkeleton />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero title="ABPath Content Specifications" description={HERO_DESCRIPTION} />
        <section className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-red-600">Error loading content specifications: {loadingError}</p>
              <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero title="ABPath Content Specifications" description={HERO_DESCRIPTION} />
        <section className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading content specifications...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="ABPath Content Specifications"
        description="Interactive ABPath content specifications with filtering by section, category, and designation – Core, Advanced Resident, Fellow."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>{data.metadata.total_sections} sections</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {data.metadata.ap_sections} AP • {data.metadata.cp_sections} CP
              </span>
            </div>
            {strategy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>•</span>
                <span className="capitalize">{strategy.replace("-", " ")}</span>
              </div>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="space-y-6">
            {/* Description Card */}
            <Card className="p-6 bg-primary/5 border-primary/20 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    ABPath Content Specifications Viewer
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    This dynamic tool lets you browse and search the official ABPath content
                    specifications for pathology board examinations. Filter by topic, designation
                    level (Core, Advanced Resident, Fellow), and export customized PDFs for your
                    study needs.
                  </p>
                  <a
                    href="https://abpath.org/content-specifications-for-examinations/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    View official ABPath content specifications
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </Card>

            {/* Controls */}
            <ABPathControls
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={categories}
              showAP={showAP}
              onToggleAP={() => setShowAP(!showAP)}
              showCP={showCP}
              onToggleCP={() => setShowCP(!showCP)}
              showC={showC}
              onToggleC={() => setShowC(!showC)}
              showAR={showAR}
              onToggleAR={() => setShowAR(!showAR)}
              showF={showF}
              onToggleF={() => setShowF(!showF)}
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
              onExportPDF={generatePDF}
            />

            {/* Statistics */}
            <ABPathStatsCard stats={stats} />

            {/* Results */}
            <div className="space-y-3">
              {filteredData.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No results found matching your criteria.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredData.map((section, sectionIndex) => (
                  <ABPathSectionCard
                    key={`section-${section.type}-${section.section}-${sectionIndex}`}
                    section={section}
                    sectionIndex={sectionIndex}
                    expandedSections={expandedSections}
                    onToggleSection={toggleSection}
                  />
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <ABPathPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalSections={pagination.totalSections}
              hasPrevPage={pagination.hasPrevPage}
              hasNextPage={pagination.hasNextPage}
              loading={loading}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
