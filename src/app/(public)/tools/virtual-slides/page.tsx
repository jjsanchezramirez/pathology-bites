"use client";

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useClientVirtualSlidesEnhanced } from "@/shared/hooks/use-client-virtual-slides-enhanced";
import { VIRTUAL_SLIDES_JSON_URL } from "@/shared/config/virtual-slides";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Search,
  Microscope,
  Filter,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  Shuffle,
  RefreshCw,
  AlertCircle,
  Info,
  GraduationCap,
} from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { ContentDisclaimer } from "@/shared/components/common/content-disclaimer";

// Import components
import { SlideRowUnified } from "./components/slide-row-unified";
import { Pagination } from "./components/pagination";
import { LoadingSkeleton } from "./components/loading-skeleton";

function VirtualSlidesContent() {
  const searchParams = useSearchParams();

  // ✅ Use enhanced search with organ-aware ranking and smart NCI fallback
  const client = useClientVirtualSlidesEnhanced(50);

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
    expandedSearchTerms: client.expandedSearchTerms,
  };

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOrganSystem, setSelectedOrganSystem] = useState("all");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Use ref for search input to avoid re-renders on every keystroke
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Metadata for filters
  const [repositories, setRepositories] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [organSystems, setOrganSystems] = useState<string[]>([]);

  // Mode management - Search or Study
  const [mode, setMode] = useState<"search" | "study">("search");

  // Enhanced features
  const [showDiagnoses, setShowDiagnoses] = useState(true);
  const [revealedDiagnoses, setRevealedDiagnoses] = useState<Set<string>>(new Set());

  // Preserve Search mode diagnosis visibility when switching to Study mode
  const searchModeDiagnosesVisibility = useRef(true);

  // Study mode specific state
  const [studyQuestionCount, setStudyQuestionCount] = useState(20);

  // Process URL parameters on mount
  useEffect(() => {
    if (!urlParamsProcessed && !client.isLoading) {
      const searchQuery = searchParams.get("search");

      if (searchQuery) {
        if (searchInputRef.current) {
          searchInputRef.current.value = searchQuery;
        }
        setDebouncedSearchTerm(searchQuery);
      }

      setUrlParamsProcessed(true);
    }
  }, [searchParams, urlParamsProcessed, client.isLoading]);

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
        console.error("Failed to load metadata:", error);
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

  // Debounced search handler - only updates state after user stops typing
  const handleSearchInput = useCallback((value: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer - only update state after 200ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 200);
  }, []);

  // Console-only notice of dataset URL after initial load completes
  useEffect(() => {
    if (!isInitialLoading) {
      console.info("[VirtualSlides] Client dataset URL:", VIRTUAL_SLIDES_JSON_URL);
    }
  }, [isInitialLoading]);

  // Automatic search when debounced term or filters change (only in Search mode)
  useEffect(() => {
    if (mode === "search") {
      searchWithFilters({
        query: debouncedSearchTerm || undefined,
        repository: selectedRepository !== "all" ? selectedRepository : undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        subcategory: selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
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
        randomMode: true,
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
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSelectedRepository("all");
    setSelectedCategory("all");
    setSelectedOrganSystem("all");
    setRevealedDiagnoses(new Set());

    // Immediately reset search options (avoid waiting for debounce/effects)
    setDebouncedSearchTerm("");
    await searchWithFilters({
      query: "",
      repository: undefined,
      category: undefined,
      subcategory: undefined,
      page: 1,
    });
  };

  const toggleDiagnoses = () => {
    const newValue = !showDiagnoses;
    console.log(`[Toggle] mode=${mode}, old=${showDiagnoses}, new=${newValue}`);
    setShowDiagnoses(newValue);
    setRevealedDiagnoses(new Set());
    // Update the saved state if in Search mode
    if (mode === "search") {
      console.log(`[Toggle] Updating ref to: ${newValue}`);
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
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHero
          title="Virtual Slide Search Engine"
          description="Search and explore thousands of virtual pathology slides from leading institutions worldwide."
        />
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
          <Card className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Virtual Slides</h3>
            <p className="text-muted-foreground mb-4">{dataError || "Unknown error occurred"}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
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
              <span>7 Repositories</span>
            </div>
          </div>
        }
      />

      {/* Search and Filter Section */}
      <section className="py-2 md:py-4">
        <div className="container px-4 mx-auto max-w-6xl">
          <Card className="p-4 md:p-8 shadow-lg">
            <CardContent className="space-y-4 md:space-y-6">
              {/* Mode Toggle */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 p-2 bg-muted/30 rounded-lg">
                <button
                  onClick={() => {
                    // If coming from Study mode, restore the saved diagnosis visibility
                    if (mode === "study") {
                      setShowDiagnoses(searchModeDiagnosesVisibility.current);
                    }
                    setMode("search");
                    // Restore search input value after component remounts
                    setTimeout(() => {
                      if (searchInputRef.current) {
                        searchInputRef.current.value = debouncedSearchTerm;
                      }
                    }, 0);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all ${
                    mode === "search"
                      ? "bg-background shadow-sm border border-border"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <Search className="h-4 w-4" />
                  Search Mode
                </button>
                <button
                  onClick={() => {
                    // Save current diagnosis visibility before entering Study mode
                    if (mode === "search") {
                      searchModeDiagnosesVisibility.current = showDiagnoses;
                    }
                    // Always hide diagnoses in Study mode
                    setShowDiagnoses(false);
                    setMode("study");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all ${
                    mode === "study"
                      ? "bg-background shadow-sm border border-border"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Study Mode
                </button>
              </div>

              {/* Study Mode Configuration */}
              {mode === "study" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="question-count" className="text-lg font-semibold">
                      Number of Questions
                    </Label>
                    <Select
                      value={studyQuestionCount.toString()}
                      onValueChange={(val) => {
                        const newCount = parseInt(val);
                        setStudyQuestionCount(newCount);
                        // The useEffect will automatically regenerate with the new count
                      }}
                    >
                      <SelectTrigger id="question-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 Questions</SelectItem>
                        <SelectItem value="20">20 Questions</SelectItem>
                        <SelectItem value="30">30 Questions</SelectItem>
                        <SelectItem value="50">50 Questions</SelectItem>
                        <SelectItem value="100">100 Questions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generate-questions" className="opacity-0 pointer-events-none">
                      Actions
                    </Label>
                    <Button
                      id="generate-questions"
                      onClick={async () => {
                        setRevealedDiagnoses(new Set());
                        const seed = Math.floor(Math.random() * 1e9);
                        await searchWithFilters({
                          query: "",
                          repository: selectedRepository !== "all" ? selectedRepository : undefined,
                          category: selectedCategory !== "all" ? selectedCategory : undefined,
                          subcategory:
                            selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
                          randomMode: true,
                          randomSeed: seed,
                          limit: studyQuestionCount,
                          page: 1,
                        });
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Shuffle className="h-4 w-4 mr-2" />
                      )}
                      Generate New Questions
                    </Button>
                  </div>
                </div>
              )}

              {/* Search Bar - Only in Search Mode */}
              {mode === "search" && (
                <div className="space-y-2 md:space-y-4">
                  <Label htmlFor="search-input" className="text-lg font-semibold">
                    Search Virtual Slides
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      ref={searchInputRef}
                      id="search-input"
                      placeholder="Search by diagnosis, patient info, repository, category, or organ system..."
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        handleSearchInput(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          // On Enter: immediately search with current value
                          e.preventDefault();
                          const currentValue = searchInputRef.current?.value || "";
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                          }
                          setDebouncedSearchTerm(currentValue);
                          searchWithFilters({
                            query: currentValue || undefined,
                            repository:
                              selectedRepository !== "all" ? selectedRepository : undefined,
                            category: selectedCategory !== "all" ? selectedCategory : undefined,
                            subcategory:
                              selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
                            page: 1,
                          });
                        }
                      }}
                      className="flex-1"
                    />

                    <Button
                      onClick={() => {
                        // On Search button click: immediately search with current input value
                        const currentValue = searchInputRef.current?.value || "";
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                        }
                        setDebouncedSearchTerm(currentValue);
                        searchWithFilters({
                          query: currentValue || undefined,
                          repository: selectedRepository !== "all" ? selectedRepository : undefined,
                          category: selectedCategory !== "all" ? selectedCategory : undefined,
                          subcategory:
                            selectedOrganSystem !== "all" ? selectedOrganSystem : undefined,
                          page: 1,
                        });
                      }}
                      disabled={isLoading}
                      className="px-6 w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Expanded Search Terms Display */}
                  {expandedSearchTerms && expandedSearchTerms.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-muted">
                      <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">Also searching for: </span>
                        <span className="font-medium">{expandedSearchTerms.join(", ")}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repository-filter">Web Repository</Label>
                  <Select value={selectedRepository} onValueChange={setSelectedRepository}>
                    <SelectTrigger>
                      <SelectValue placeholder="All repositories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Repositories</SelectItem>
                      {repositories.map((repo, index) => (
                        <SelectItem key={`repo-${index}-${repo}`} value={repo as string}>
                          {repo as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-filter">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category, index) => (
                        <SelectItem key={`cat-${index}-${category}`} value={category as string}>
                          {category as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organ-system-filter">Organ System</Label>
                  <Select value={selectedOrganSystem} onValueChange={setSelectedOrganSystem}>
                    <SelectTrigger>
                      <SelectValue placeholder="All organ systems" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organ Systems</SelectItem>
                      {organSystems.map((system, index) => (
                        <SelectItem key={`sys-${index}-${system}`} value={system as string}>
                          {system as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button and Filter Summary */}
              <div className="space-y-2 md:space-y-4">
                {/* Desktop: Horizontal layout */}
                <div className="hidden md:flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {mode === "study" ? (
                      <>
                        <GraduationCap className="h-4 w-4" />
                        <span>Showing {displaySlides.length.toLocaleString()} questions</span>
                      </>
                    ) : (
                      <>
                        <Filter className="h-4 w-4" />
                        <span>
                          Showing {totalResults.toLocaleString()} of {totalSlides.toLocaleString()}{" "}
                          slides
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={clearFilters} size="sm">
                      Clear Filters
                    </Button>
                    <Button
                      variant={showDiagnoses ? "outline" : "default"}
                      size="sm"
                      onClick={toggleDiagnoses}
                    >
                      {showDiagnoses ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide Diagnoses
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Show Diagnoses
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Mobile: Vertical layout */}
                <div className="md:hidden space-y-3">
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={clearFilters} size="sm" className="w-full">
                      Clear Filters
                    </Button>
                    <Button
                      variant={showDiagnoses ? "outline" : "default"}
                      size="sm"
                      onClick={toggleDiagnoses}
                      className="w-full"
                    >
                      {showDiagnoses ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide Diagnoses
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Show Diagnoses
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {mode === "study" ? (
                      <>
                        <GraduationCap className="h-4 w-4" />
                        <span>Showing {displaySlides.length} questions</span>
                      </>
                    ) : (
                      <>
                        <Filter className="h-4 w-4" />
                        <span>
                          Showing {totalResults.toLocaleString()} of {totalSlides.toLocaleString()}{" "}
                          slides
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {isInitialLoading || isLoading ? (
        <section className="relative py-4 md:py-8">
          <div className="container px-4 mx-auto max-w-6xl">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-2 md:p-4 font-semibold">Preview</th>
                        <th className="text-left p-2 md:p-4 font-semibold">
                          <span className="md:hidden">Slide Info</span>
                          <span className="hidden md:inline lg:hidden">
                            {showDiagnoses ? "Diagnosis and Clinical Info" : "Slide Info"}
                          </span>
                          <span className="hidden lg:inline">
                            {showDiagnoses ? "Diagnosis and Clinical Info" : "Slide Info"}
                          </span>
                        </th>
                        <th className="text-left p-2 md:p-4 font-semibold hidden lg:table-cell">
                          Repository
                        </th>
                        <th className="text-left p-2 md:p-4 font-semibold hidden md:table-cell">
                          Category
                        </th>
                        <th className="text-left p-2 md:p-4 font-semibold hidden lg:table-cell">
                          Details
                        </th>
                        <th className="text-left p-2 md:p-4 font-semibold">
                          <span className="md:hidden">Action</span>
                          <span className="hidden md:inline">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <LoadingSkeleton variant="table" />
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        displaySlides.length > 0 && (
          <section className="relative py-4 md:py-8">
            <div className="container px-4 mx-auto max-w-6xl">
              <Card className="shadow-lg">
                <CardContent className="p-0">
                  {/* Results Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left p-2 md:p-4 font-semibold">Preview</th>
                          <th className="text-left p-2 md:p-4 font-semibold">
                            <span className="md:hidden">Slide Info</span>
                            <span className="hidden md:inline lg:hidden">
                              {showDiagnoses ? "Diagnosis and Clinical Info" : "Slide Info"}
                            </span>
                            <span className="hidden lg:inline">
                              {showDiagnoses ? "Diagnosis and Clinical Info" : "Slide Info"}
                            </span>
                          </th>
                          <th className="text-left p-2 md:p-4 font-semibold hidden lg:table-cell">
                            Repository
                          </th>
                          <th className="text-left p-2 md:p-4 font-semibold hidden md:table-cell">
                            Category
                          </th>
                          <th className="text-left p-2 md:p-4 font-semibold hidden lg:table-cell">
                            Details
                          </th>
                          <th className="text-left p-2 md:p-4 font-semibold">
                            <span className="md:hidden">Action</span>
                            <span className="hidden md:inline">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displaySlides.map((slide, index) => (
                          <SlideRowUnified
                            key={`${slide.id}-${index}`}
                            slide={slide}
                            index={index}
                            showDiagnoses={showDiagnoses}
                            isRevealed={revealedDiagnoses.has(slide.id)}
                            onToggleReveal={() => toggleDiagnosisReveal(slide.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {mode === "search" && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={client.currentSearchOptions.limit || 20}
                      totalItems={totalResults}
                      onPageChange={goToPage}
                      onItemsPerPageChange={(n) => searchWithFilters({ limit: n, page: 1 })}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )
      )}

      {/* No Results */}
      {displaySlides.length === 0 && !isLoading && !isInitialLoading && (
        <section className="relative py-16">
          <div className="container px-4 mx-auto max-w-4xl text-center">
            <div className="space-y-4">
              <Microscope className="h-16 w-16 text-muted-foreground mx-auto" />
              <h3 className="text-xl font-semibold">No slides found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or filters to find more results.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear All Filters
              </Button>
            </div>
          </div>
        </section>
      )}

      <ContentDisclaimer />

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
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
