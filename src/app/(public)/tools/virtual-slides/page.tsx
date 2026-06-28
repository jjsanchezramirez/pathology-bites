"use client";

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useClientVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import { VIRTUAL_SLIDES_JSON_URL } from "@/shared/config/virtual-slides";
import { Microscope, FileText } from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { ContentDisclaimer } from "@/shared/components/common/content-disclaimer";

// Import components
import { SlideViewerModal } from "@/shared/components/common/slide-viewer-modal";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import { LoadingSkeleton } from "@/features/public/tools/virtual-slides/components/loading-skeleton";
import { log } from "@/shared/utils/logging";
import { VirtualSlidesErrorState } from "./virtual-slides-error-state";
import { RepositoryLogoStrip } from "./repository-logo-strip";
import { VirtualSlidesModeToggle } from "./virtual-slides-mode-toggle";
import { SearchFilterCard } from "./search-filter-card";
import { SlideResultsTable } from "./slide-results-table";
import { NoResultsSection } from "./no-results-section";

function VirtualSlidesContent() {
  const searchParams = useSearchParams();

  // ✅ Use enhanced search with organ-aware ranking and smart NCI fallback
  const client = useClientVirtualSlides(50);

  const {
    slides,
    isLoading,
    dataError,
    currentPage,
    totalPages,
    totalResults,
    searchWithFilters,
    goToPage,
    totalSlides,
    filteredTotal,
    expandedSearchTerms,
  } = {
    slides: client.slides,
    isLoading: client.isLoading,
    dataError: client.error,
    currentPage: client.currentPage,
    totalPages: client.totalPages,
    totalResults: client.totalResults,
    searchWithFilters: client.searchWithFilters,
    goToPage: client.goToPage,
    totalSlides: client.totalSlides,
    filteredTotal: client.filteredTotal,
    expandedSearchTerms: client.expandedSearchTerms,
  };

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => {
    // Initialize from URL parameter if present
    const searchQuery = searchParams.get("search");
    return searchQuery || "";
  });
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOrganSystem, setSelectedOrganSystem] = useState("all");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Use ref for debounce timer and input
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Metadata for filters
  const [repositories, setRepositories] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [organSystems, setOrganSystems] = useState<string[]>([]);

  // Mode management - Search or Study
  const [mode, setMode] = useState<"search" | "study">("search");

  // Enhanced features
  const [viewerSlide, setViewerSlide] = useState<VirtualSlide | null>(null);
  // MGH: open the viewer focused on a specific within-case slide (/list name hash). Cleared
  // for normal opens so the viewer defaults to the case's H&E representative.
  const [viewerInitialSlide, setViewerInitialSlide] = useState<string | undefined>(undefined);
  const [showDiagnoses, setShowDiagnoses] = useState(true);
  const [revealedDiagnoses, setRevealedDiagnoses] = useState<Set<string>>(new Set());

  // Preserve Search mode diagnosis visibility when switching to Study mode
  const searchModeDiagnosesVisibility = useRef(true);

  // Study mode specific state
  const [studyQuestionCount, setStudyQuestionCount] = useState(20);

  // Set input field value from URL parameter on mount
  useEffect(() => {
    if (!urlParamsProcessed) {
      const searchQuery = searchParams.get("search");

      if (searchQuery && searchInputRef.current) {
        searchInputRef.current.value = searchQuery;
      }

      setUrlParamsProcessed(true);
    }
  }, [searchParams, urlParamsProcessed]);

  // Update URL when search term changes (only in Search mode)
  useEffect(() => {
    if (urlParamsProcessed && mode === "search") {
      const url = new URL(window.location.href);

      if (debouncedSearchTerm && debouncedSearchTerm.trim() !== "") {
        url.searchParams.set("search", debouncedSearchTerm);
      } else {
        url.searchParams.delete("search");
      }

      // Update URL without page reload
      window.history.replaceState({}, "", url.toString());
    }
  }, [debouncedSearchTerm, urlParamsProcessed, mode]);

  // Load metadata for filters (client-only when available)
  useEffect(() => {
    async function loadMetadata() {
      try {
        // Derive from client data hook when ready
        if (!client.isLoading && client.totalSlides > 0) {
          setRepositories(client.repositories);
          setCategories(client.categories);
          setOrganSystems(client.organSystems);
        }
      } catch (error) {
        log.error("Failed to load metadata:", error);
      }
    }
    loadMetadata();
  }, [
    client.isLoading,
    client.totalSlides,
    client.repositories,
    client.categories,
    client.organSystems,
  ]);

  // Initialize with empty search to load all slides
  useEffect(() => {
    // client hook loads automatically; just mark ready when not loading
    if (!client.isLoading) setIsInitialLoading(false);
  }, [client.isLoading]);

  // Debounce handler for search input
  const handleSearchInput = useCallback((value: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer - only update state after 300ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 300);
  }, []);

  // Console-only notice of dataset URL after initial load completes
  useEffect(() => {
    if (!isInitialLoading) {
      log.info("[VirtualSlides] Client dataset URL:", VIRTUAL_SLIDES_JSON_URL);
    }
  }, [isInitialLoading]);

  // Automatic search when debounced term or filters change (only in Search mode)
  useEffect(() => {
    if (mode === "search") {
      const isEmptySearch = !debouncedSearchTerm || debouncedSearchTerm.trim() === "";
      searchWithFilters({
        query: debouncedSearchTerm || undefined,
        repository: selectedRepository !== "all" ? selectedRepository : undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
        randomSeed: isEmptySearch ? Math.floor(Math.random() * 1e9) : undefined,
        page: 1, // Reset to first page when filters change
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, selectedRepository, selectedCategory, selectedOrganSystem, mode]);

  // Use slides directly from API (server-side filtering, no client-side filtering needed)
  // In Study mode, limit to question count
  const displaySlides = useMemo(() => {
    if (mode === "study") {
      // In study mode, just limit to the question count (slides are already randomized)
      return slides.slice(0, studyQuestionCount);
    }
    return slides;
  }, [slides, mode, studyQuestionCount]);

  // Auto-trigger random mode when entering Study mode or filters change in Study mode
  useEffect(() => {
    if (mode === "study") {
      const seed = Math.floor(Math.random() * 1e9);
      searchWithFilters({
        query: "",
        repository: selectedRepository !== "all" ? selectedRepository : undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
        randomSeed: seed,
        limit: studyQuestionCount,
        page: 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedRepository, selectedCategory, selectedOrganSystem, studyQuestionCount]);

  // Simplified handlers for unified search
  const clearFilters = async () => {
    // Reset local UI state
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    setDebouncedSearchTerm("");
    setSelectedRepository("all");
    setSelectedCategory("all");
    setSelectedOrganSystem("all");
    setRevealedDiagnoses(new Set());

    // Immediately reset search options (avoid waiting for debounce/effects)
    await searchWithFilters({
      query: "",
      repository: undefined,
      category: undefined,
      subcategory: undefined,
      randomSeed: mode === "study" ? Math.floor(Math.random() * 1e9) : undefined,
      page: 1,
    });
  };

  const toggleDiagnoses = () => {
    const newValue = !showDiagnoses;
    log.debug(`[Toggle] mode=${mode}, old=${showDiagnoses}, new=${newValue}`);
    setShowDiagnoses(newValue);
    setRevealedDiagnoses(new Set());
    // Update the saved state if in Search mode
    if (mode === "search") {
      log.debug(`[Toggle] Updating ref to: ${newValue}`);
      searchModeDiagnosesVisibility.current = newValue;
    }
  };

  const toggleDiagnosisReveal = (slideId: string) => {
    setRevealedDiagnoses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(slideId)) {
        newSet.delete(slideId);
      } else {
        newSet.add(slideId);
      }
      return newSet;
    });
  };

  const handleSelectSearch = async () => {
    // If coming from Study mode, restore the saved diagnosis visibility and re-run search
    if (mode === "study") {
      setShowDiagnoses(searchModeDiagnosesVisibility.current);
      setMode("search");
      const isEmptySearch = !debouncedSearchTerm || debouncedSearchTerm.trim() === "";
      await searchWithFilters({
        query: debouncedSearchTerm || undefined,
        repository: selectedRepository !== "all" ? selectedRepository : undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
        randomSeed: isEmptySearch ? Math.floor(Math.random() * 1e9) : undefined,
        page: 1,
      });
    } else {
      setMode("search");
    }
  };

  const handleSelectStudy = () => {
    // Save current diagnosis visibility before entering Study mode
    if (mode === "search") {
      searchModeDiagnosesVisibility.current = showDiagnoses;
    }
    // Always hide diagnoses in Study mode
    setShowDiagnoses(false);
    setMode("study");
  };

  const openViewer = (slide: VirtualSlide) => {
    setViewerInitialSlide(undefined);
    setViewerSlide(slide);
  };

  // Immediately search with the current input value (used by Enter + the Search button)
  const runImmediateSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const currentValue = searchInputRef.current?.value || "";
    setDebouncedSearchTerm(currentValue);
    const isEmptySearch = !currentValue || currentValue.trim() === "";
    searchWithFilters({
      query: currentValue || undefined,
      repository: selectedRepository !== "all" ? selectedRepository : undefined,
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
      randomSeed: isEmptySearch ? Math.floor(Math.random() * 1e9) : undefined,
      page: 1,
    });
  };

  const runGenerateQuestions = async () => {
    setRevealedDiagnoses(new Set());
    const seed = Math.floor(Math.random() * 1e9);
    await searchWithFilters({
      query: "",
      repository: selectedRepository !== "all" ? selectedRepository : undefined,
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
      randomSeed: seed,
      limit: studyQuestionCount,
      page: 1,
    });
  };

  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHero
          title="Virtual Slide Search Engine"
          description="Search and explore thousands of virtual pathology slides from leading institutions worldwide. Find cases by diagnosis, organ system, repository, and more."
          actions={
            <div className="flex gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Microscope className="h-4 w-4" />
                <span>Loading ultra-minimal search index...</span>
              </div>
            </div>
          }
        />
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
          <LoadingSkeleton variant="cards" />
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (dataError) {
    return <VirtualSlidesErrorState error={dataError} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <PublicHero
        title="Virtual Slide Search Engine"
        description="Search and explore thousands of virtual pathology slides from leading institutions worldwide. Find cases by diagnosis, organ system, repository, and more."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Microscope className="h-4 w-4" />
              <span>{totalSlides.toLocaleString()} Virtual Slides</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>10 Repositories</span>
            </div>
          </div>
        }
      />

      {/* Repository logos — static strip */}
      <RepositoryLogoStrip />

      {/* Mode Toggle - Above Card */}
      <section className="py-2 md:py-4">
        <div className="container px-4 mx-auto max-w-6xl">
          <VirtualSlidesModeToggle
            mode={mode}
            onSelectSearch={handleSelectSearch}
            onSelectStudy={handleSelectStudy}
          />

          {/* Search and Filter Card */}
          <SearchFilterCard
            mode={mode}
            studyQuestionCount={studyQuestionCount}
            onStudyQuestionCountChange={setStudyQuestionCount}
            searchInputRef={searchInputRef}
            initialSearchValue={searchParams.get("search") || ""}
            onSearchInput={handleSearchInput}
            onImmediateSearch={runImmediateSearch}
            onGenerateQuestions={runGenerateQuestions}
            selectedRepository={selectedRepository}
            onRepositoryChange={setSelectedRepository}
            repositories={repositories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={categories}
            selectedOrganSystem={selectedOrganSystem}
            onOrganSystemChange={setSelectedOrganSystem}
            organSystems={organSystems}
            isLoading={isLoading}
            expandedSearchTerms={expandedSearchTerms}
            displaySlidesCount={displaySlides.length}
            totalResults={totalResults}
            filteredTotal={filteredTotal}
            showDiagnoses={showDiagnoses}
            onToggleDiagnoses={toggleDiagnoses}
            onClearFilters={clearFilters}
          />
        </div>
      </section>

      {/* Results Section */}
      <SlideResultsTable
        isInitialLoading={isInitialLoading}
        displaySlides={displaySlides}
        mode={mode}
        showDiagnoses={showDiagnoses}
        revealedDiagnoses={revealedDiagnoses}
        onToggleReveal={toggleDiagnosisReveal}
        onOpenViewer={openViewer}
        onOpenViewerAt={(slide, slideName) => {
          setViewerInitialSlide(slideName);
          setViewerSlide(slide);
        }}
        onOpenRelated={openViewer}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={client.currentSearchOptions.limit || 20}
        totalItems={totalResults}
        onPageChange={goToPage}
        onItemsPerPageChange={(n) => searchWithFilters({ limit: n, page: 1 })}
      />

      {/* No Results - Show immediately when no results, hide during loading */}
      {displaySlides.length === 0 && !isInitialLoading && (
        <NoResultsSection
          hasActiveFilters={
            selectedRepository !== "all" ||
            selectedCategory !== "all" ||
            selectedOrganSystem !== "all"
          }
          hasAnyFilterOrSearch={
            !!debouncedSearchTerm ||
            selectedRepository !== "all" ||
            selectedCategory !== "all" ||
            selectedOrganSystem !== "all"
          }
          onClearFilters={clearFilters}
        />
      )}

      <ContentDisclaimer />

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />

      {/* In-house OSD viewer (prototype) — opens a supported slide in place. */}
      <SlideViewerModal
        slide={viewerSlide}
        initialSlide={viewerInitialSlide}
        onClose={() => setViewerSlide(null)}
      />
    </div>
  );
}

export default function VirtualSlidesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VirtualSlidesContent />
    </Suspense>
  );
}
