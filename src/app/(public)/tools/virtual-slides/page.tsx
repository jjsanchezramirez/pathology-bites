'use client'

import { useState, useMemo, useEffect } from 'react'
import { useClientVirtualSlides } from '@/shared/hooks/use-client-virtual-slides'
import { VIRTUAL_SLIDES_JSON_URL } from '@/shared/config/virtual-slides'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
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
  ArrowLeft,
  AlertCircle
} from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { ContentDisclaimer } from '@/shared/components/common/content-disclaimer'

// Import components
import { SlideRowUnified } from './components/slide-row-unified'
import { Pagination } from './components/pagination'
import { LoadingSkeleton } from './components/loading-skeleton'

export default function VirtualSlidesPage() {
  // ✅ Use unified search - server-side filtering with proper pagination
  // Client-only mode (always)
  const client = useClientVirtualSlides(50)

  const {
    slides,
    isLoading,
    dataError,
    currentPage,
    totalPages,
    totalResults,
    search,
    searchWithFilters,
    nextPage,
    previousPage,
    goToPage,
    totalSlides,
    currentSearchOptions
  } = {
    slides: client.slides,
    isLoading: client.isLoading,
    dataError: client.error,
    currentPage: client.currentPage,
    totalPages: client.totalPages,
    totalResults: client.totalResults,
    search: client.search,
    searchWithFilters: client.searchWithFilters,
    nextPage: client.nextPage,
    previousPage: client.previousPage,
    goToPage: client.goToPage,
    totalSlides: client.totalSlides,
    currentSearchOptions: client.currentSearchOptions
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRepository, setSelectedRepository] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedOrganSystem, setSelectedOrganSystem] = useState('all')
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Metadata for filters
  const [repositories, setRepositories] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [organSystems, setOrganSystems] = useState<string[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)

  // Enhanced features
  const [showDiagnoses, setShowDiagnoses] = useState(true)
  const [isRandomMode, setIsRandomMode] = useState(false)
  const [revealedDiagnoses, setRevealedDiagnoses] = useState<Set<string>>(new Set())

  // Load metadata for filters (client-only when available)
  useEffect(() => {
    async function loadMetadata() {
      try {
        setIsLoadingMetadata(true)
        // Derive from client data hook when ready
        if (!client.isLoading && client.totalSlides > 0) {
          setRepositories(client.repositories)
          setCategories(client.categories)
          setOrganSystems(client.organSystems)
        }
      } catch (error) {
        console.error('Failed to load metadata:', error)
      } finally {
        setIsLoadingMetadata(false)
      }
    }
    loadMetadata()
  }, [client.isLoading, client.totalSlides, client.repositories, client.categories, client.organSystems])

  // Initialize with empty search to load all slides
  useEffect(() => {
    // client hook loads automatically; just mark ready when not loading
    if (!client.isLoading) setIsInitialLoading(false)
  }, [client.isLoading])

  // Debounce search term to reduce jittery updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms delay
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Console-only notice of dataset URL after initial load completes
  useEffect(() => {
    if (!isInitialLoading) {
      console.info('[VirtualSlides] Client dataset URL:', VIRTUAL_SLIDES_JSON_URL)
    }
  }, [isInitialLoading])

  // Automatic search when any filter changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return // Only search when debounce is complete

    searchWithFilters({
      query: debouncedSearchTerm || undefined,
      repository: selectedRepository !== 'all' ? selectedRepository : undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      subcategory: selectedOrganSystem !== 'all' ? selectedOrganSystem : undefined,
      randomMode: isRandomMode,
      page: 1 // Reset to first page when filters change
    })
  }, [debouncedSearchTerm, selectedRepository, selectedCategory, selectedOrganSystem, isRandomMode, searchWithFilters])

  // Use slides directly from API (server-side filtering, no client-side filtering needed)
  const displaySlides = slides

  // Simplified handlers for unified search
  const clearFilters = async () => {
    // Reset local UI state
    setSearchTerm('')
    setSelectedRepository('all')
    setSelectedCategory('all')
    setSelectedOrganSystem('all')
    setIsRandomMode(false)
    setRevealedDiagnoses(new Set())

    // Immediately reset search options (avoid waiting for debounce/effects)
    await searchWithFilters({
      query: '',
      repository: undefined,
      category: undefined,
      subcategory: undefined,
      randomMode: false,
      page: 1
    })
  }

  const toggleDiagnoses = () => {
    setShowDiagnoses(!showDiagnoses)
    setRevealedDiagnoses(new Set())
  }

  const toggleDiagnosisReveal = (slideId: string) => {
    setRevealedDiagnoses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(slideId)) {
        newSet.delete(slideId)
      } else {
        newSet.add(slideId)
      }
      return newSet
    })
  }

  const handleRandomClick = async () => {
    setRevealedDiagnoses(new Set())

    if (!isRandomMode) {
      // Entering random mode: clear query and reset filters to broaden results
      setIsRandomMode(true)
      setSearchTerm('')
      setSelectedRepository('all')
      setSelectedCategory('all')
      setSelectedOrganSystem('all')
      setShowDiagnoses(false)

      const seed = Math.floor(Math.random() * 1e9)
      await searchWithFilters({
        query: '',
        repository: undefined,
        category: undefined,
        subcategory: undefined,
        randomMode: true,
        randomSeed: seed,
        page: 1
      })
    } else {
      // Already in random mode: keep filters as-is, just reshuffle with a new seed
      const seed = Math.floor(Math.random() * 1e9)
      await searchWithFilters({
        randomMode: true,
        randomSeed: seed,
        page: 1
      })
    }
  }





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
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <LoadingSkeleton variant="cards" />
        </div>
      </div>
    )
  }

  // Show error state if data failed to load
  if (dataError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHero
          title="Virtual Slide Search Engine"
          description="Search and explore thousands of virtual pathology slides from leading institutions worldwide."
        />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Card className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Virtual Slides</h3>
            <p className="text-muted-foreground mb-4">
              {dataError || 'Unknown error occurred'}
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    )
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
      <section className="py-4">
        <div className="container px-4 mx-auto max-w-6xl">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Search Bar */}
              <div className="space-y-4">
                <Label htmlFor="search-input" className="text-lg font-semibold">
                  {isRandomMode ? 'Random Discovery Mode' : 'Search Virtual Slides'}
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="search-input"
                    placeholder={isRandomMode
                      ? "Start typing to exit random mode and search..."
                      : "Search by diagnosis, patient info, repository, category, or organ system..."
                    }
                    value={searchTerm}
                    onChange={(e) => {
                      const val = e.target.value
                      setSearchTerm(val)
                      // Any editing exits random mode so clearing search restores full list
                      if (isRandomMode) {
                        setIsRandomMode(false)
                      }
                    }}
                    className="flex-1"
                  />

                  {/* Show appropriate button based on mode */}
                  {isRandomMode ? (
                    <Button
                      variant="outline"
                      onClick={handleRandomClick}
                      disabled={isLoading}
                      className="px-6 w-full sm:w-auto"
                    >
                      <Shuffle className="h-4 w-4 mr-2" />
                      New Surprise
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleRandomClick}
                      disabled={isLoading}
                      className="px-6 w-full sm:w-auto"
                    >
                      <Shuffle className="h-4 w-4 mr-2" />
                      Surprise Me!
                    </Button>
                  )}

                  <Button
                    onClick={() => search(searchTerm)}
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
              </div>

                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="repository-filter">Web Repository</Label>
                      <Select
                        value={selectedRepository}
                        onValueChange={setSelectedRepository}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All repositories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Repositories</SelectItem>
                          {repositories.map((repo, index) => (
                            <SelectItem key={`repo-${index}-${repo}`} value={repo as string}>{repo as string}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category-filter">Category</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category, index) => (
                            <SelectItem key={`cat-${index}-${category}`} value={category as string}>{category as string}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organ-system-filter">Organ System</Label>
                      <Select
                        value={selectedOrganSystem}
                        onValueChange={setSelectedOrganSystem}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All organ systems" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Organ Systems</SelectItem>
                          {organSystems.map((system, index) => (
                            <SelectItem key={`sys-${index}-${system}`} value={system as string}>{system as string}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Clear Filters Button and Filter Summary */}
                  <div className="space-y-4">
                    {/* Desktop: Horizontal layout */}
                    <div className="hidden md:flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {isRandomMode ? (
                          <>
                            <Shuffle className="h-4 w-4" />
                            <span>
                              Showing {displaySlides.length.toLocaleString()} random slides
                            </span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-4 w-4" />
                            <span>
                              Showing {totalResults.toLocaleString()} of {totalSlides.toLocaleString()} slides
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isRandomMode && (
                          <Button variant="outline" onClick={() => setIsRandomMode(false)} size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Search
                          </Button>
                        )}
                        {!isRandomMode && (
                          <Button variant="outline" onClick={clearFilters} size="sm">
                            Clear Filters
                          </Button>
                        )}
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
                        {isRandomMode && (
                          <Button variant="outline" onClick={() => setIsRandomMode(false)} size="sm" className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Search
                          </Button>
                        )}
                        {!isRandomMode && (
                          <Button variant="outline" onClick={clearFilters} size="sm" className="w-full">
                            Clear Filters
                          </Button>
                        )}
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
                        {isRandomMode ? (
                          <>
                            <Shuffle className="h-4 w-4" />
                            <span>
                              Showing {displaySlides.length.toLocaleString()} random slides
                            </span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-4 w-4" />
                            <span>
                              Showing {totalResults.toLocaleString()} of {totalSlides.toLocaleString()} slides
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
      {(isInitialLoading || isLoading) ? (
        <section className="relative py-8">
          <div className="container px-4 mx-auto max-w-6xl">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-semibold">Preview</th>
                        <th className="text-left p-4 font-semibold">
                          <span className="md:hidden">Slide Info</span>
                          <span className="hidden md:inline lg:hidden">
                            {showDiagnoses ? 'Diagnosis and Clinical Info' : 'Slide Info'}
                          </span>
                          <span className="hidden lg:inline">
                            {showDiagnoses ? 'Diagnosis and Clinical Info' : 'Slide Info'}
                          </span>
                        </th>
                        <th className="text-left p-4 font-semibold hidden lg:table-cell">Repository</th>
                        <th className="text-left p-4 font-semibold hidden md:table-cell">Category</th>
                        <th className="text-left p-4 font-semibold hidden lg:table-cell">Details</th>
                        <th className="text-left p-4 font-semibold">
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
      ) : displaySlides.length > 0 && (
        <section className="relative py-8">
          <div className="container px-4 mx-auto max-w-6xl">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-semibold">Preview</th>
                        <th className="text-left p-4 font-semibold">
                          <span className="md:hidden">Slide Info</span>
                          <span className="hidden md:inline lg:hidden">
                            {showDiagnoses ? 'Diagnosis and Clinical Info' : 'Slide Info'}
                          </span>
                          <span className="hidden lg:inline">
                            {showDiagnoses ? 'Diagnosis and Clinical Info' : 'Slide Info'}
                          </span>
                        </th>
                        <th className="text-left p-4 font-semibold hidden lg:table-cell">Repository</th>
                        <th className="text-left p-4 font-semibold hidden md:table-cell">Category</th>
                        <th className="text-left p-4 font-semibold hidden lg:table-cell">Details</th>
                        <th className="text-left p-4 font-semibold">
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

                {!isRandomMode && (
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
  )
}
