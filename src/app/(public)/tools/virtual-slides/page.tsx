'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
import Image from 'next/image'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

// Import types and utilities
import { VirtualSlide } from './types'
import {
  createAcronymMap,
  createSearchIndex,
  getUniqueRepositories,
  getUniqueCategories,
  getUniqueOrganSystems,
  searchSlides,
  applyFilters
} from './utils/search'

// Import components
import { SlideRow } from './components/slide-row'
import { Pagination } from './components/pagination'
import { LoadingSkeleton } from './components/loading-skeleton'

export default function VirtualSlidesPage() {
  // Data state
  const [virtualSlidesData, setVirtualSlidesData] = useState<VirtualSlide[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRepository, setSelectedRepository] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedOrganSystem, setSelectedOrganSystem] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [itemsPerPage, setItemsPerPage] = useState(30)

  // New state for enhanced features
  const [showDiagnoses, setShowDiagnoses] = useState(true)
  const [isRandomMode, setIsRandomMode] = useState(false)
  const [revealedDiagnoses, setRevealedDiagnoses] = useState<Set<string>>(new Set())

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  // Debounce search term to reduce jittery updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch virtual slides data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true)
        setDataError(null)

        const response = await fetch('/api/virtual-slides')
        if (!response.ok) {
          throw new Error(`Failed to fetch virtual slides: ${response.status}`)
        }

        const result = await response.json()
        // The API returns { data: slides[], metadata: {...} }
        const slides = result.data || result
        setVirtualSlidesData(slides)
      } catch (error) {
        console.error('Error fetching virtual slides:', error)
        setDataError(error instanceof Error ? error.message : 'Failed to load virtual slides')
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [])

  // Get unique values for filters
  const repositories = useMemo(() => getUniqueRepositories(virtualSlidesData), [virtualSlidesData])
  const categories = useMemo(() => getUniqueCategories(virtualSlidesData), [virtualSlidesData])
  const organSystems = useMemo(() => getUniqueOrganSystems(virtualSlidesData), [virtualSlidesData])

  // Dynamic acronym mapping and search index
  const acronymMap = useMemo(() => createAcronymMap(virtualSlidesData), [virtualSlidesData])
  const searchIndex = useMemo(() => createSearchIndex(virtualSlidesData), [virtualSlidesData])

  // Search function using utility
  const searchSlidesCallback = useCallback((searchTerm: string): VirtualSlide[] => {
    return searchSlides(searchTerm, searchIndex, acronymMap)
  }, [searchIndex, acronymMap])

  // Random slide generation function with filter support
  const generateRandomSlides = useCallback((count: number): VirtualSlide[] => {
    // First apply filters to get eligible slides
    let eligibleSlides = virtualSlidesData

    if (selectedRepository !== 'all') {
      eligibleSlides = eligibleSlides.filter(slide => slide.repository === selectedRepository)
    }

    if (selectedCategory !== 'all') {
      eligibleSlides = eligibleSlides.filter(slide => slide.category === selectedCategory)
    }

    if (selectedOrganSystem !== 'all') {
      eligibleSlides = eligibleSlides.filter(slide => slide.subcategory === selectedOrganSystem)
    }

    // Then shuffle and return the requested count
    const shuffled = [...eligibleSlides].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }, [selectedRepository, selectedCategory, selectedOrganSystem])

  // Filtering logic using utilities
  const filteredSlides = useMemo(() => {
    if (isRandomMode) {
      // Generate random slides to fill the current page
      return generateRandomSlides(itemsPerPage)
    }

    // Start with search results
    const searchResults = searchSlidesCallback(debouncedSearchTerm)

    // Apply filters
    return applyFilters(searchResults, selectedRepository, selectedCategory, selectedOrganSystem)
  }, [debouncedSearchTerm, selectedRepository, selectedCategory, selectedOrganSystem, searchSlidesCallback, isRandomMode, generateRandomSlides, itemsPerPage])

  // Pagination
  const totalPages = isRandomMode ? 1 : Math.ceil(filteredSlides.length / itemsPerPage)
  const paginatedSlides = isRandomMode
    ? filteredSlides // Random mode already returns the right amount
    : filteredSlides.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )

  const handleSearch = () => {
    setIsLoading(true)
    setCurrentPage(1)
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleFilterChange = (filterType: string, value: string) => {
    setIsLoading(true)
    setCurrentPage(1)

    switch(filterType) {
      case 'repository':
        setSelectedRepository(value)
        break
      case 'category':
        setSelectedCategory(value)
        break
      case 'organSystem':
        setSelectedOrganSystem(value)
        break
    }

    // If in random mode, clear revealed diagnoses for new random set
    if (isRandomMode) {
      setRevealedDiagnoses(new Set())
    }

    setTimeout(() => setIsLoading(false), 300)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedRepository('all')
    setSelectedCategory('all')
    setSelectedOrganSystem('all')
    setCurrentPage(1)
    setIsRandomMode(false)
    setRevealedDiagnoses(new Set())
  }

  const toggleDiagnoses = () => {
    setShowDiagnoses(!showDiagnoses)
    // Clear revealed diagnoses when toggling global visibility
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

  const toggleRandomMode = () => {
    setIsLoading(true)
    setIsRandomMode(!isRandomMode)
    setCurrentPage(1)
    setRevealedDiagnoses(new Set())
    // When entering random mode, clear search but preserve filters
    if (!isRandomMode) {
      setSearchTerm('')
      // Automatically hide diagnoses when entering random mode
      setShowDiagnoses(false)
    }
    setTimeout(() => setIsLoading(false), 500)
  }

  const generateNewRandomSlides = () => {
    if (isRandomMode) {
      setIsLoading(true)
      setRevealedDiagnoses(new Set())
      // Force re-render by toggling random mode briefly
      setIsRandomMode(false)
      setTimeout(() => {
        setIsRandomMode(true)
        setIsLoading(false)
      }, 100)
    }
  }

  // Show loading state while fetching data
  if (isLoadingData) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHero
          title="Virtual Slide Search Engine"
          description="Loading virtual pathology slides from leading institutions worldwide..."
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
            <p className="text-muted-foreground mb-4">{dataError}</p>
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
              <span>{virtualSlidesData.length.toLocaleString()} Virtual Slides</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{repositories.length} Repositories</span>
            </div>
          </div>
        }
      />

      {/* Repository Logos Section - Hidden on mobile */}
      <section className="py-8 bg-background hidden md:block">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 overflow-x-auto">
            {[
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/university-of-leeds-logo.png', alt: 'University of Leeds' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/mgh-logo.png', alt: 'MGH Pathology' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/path-presenter-logo.png', alt: 'PathPresenter' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/rosai-collection-logo.png', alt: 'Rosai Collection' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/university-of-toronto-logo.png', alt: 'University of Toronto LMP' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/hematopathology-etutorial-logo.png', alt: 'Hematopathology eTutorial' },
              { src: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/logos/recut-club-logo.png', alt: 'Recut Club' }
            ].map((logo, index) => (
              <div
                key={index}
                className="logo-container flex items-center justify-center h-8 w-16 md:h-12 md:w-24 lg:h-14 lg:w-28 flex-shrink-0 transition-opacity duration-300"
                style={{
                  animation: 'fadeInToHalf 1s ease-out forwards',
                  animationDelay: `${index * 100}ms`,
                  opacity: 0
                }}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={logo.src}
                    alt={logo.alt}
                    width={112}
                    height={56}
                    unoptimized
                    className="object-contain h-full w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeInToHalf {
            from {
              opacity: 0;
            }
            to {
              opacity: 0.5;
            }
          }

          .logo-container:hover {
            opacity: 1 !important;
          }
        `}</style>
      </section>

      {/* Search and Filter Section */}
      <section className="py-4">
        <div className="container px-4 mx-auto max-w-6xl">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {isInitialLoading ? (
                <>
                  {/* Search Bar Skeleton */}
                  <div className="space-y-4">
                    <div className="h-6 bg-muted rounded animate-pulse w-48" />
                    <div className="flex gap-2">
                      <div className="h-10 bg-muted rounded animate-pulse flex-1" />
                      <div className="h-10 bg-muted rounded animate-pulse w-24" />
                    </div>
                  </div>

                  {/* Filters Skeleton */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-24" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-16" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-20" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                  </div>

                  {/* Filter Summary Skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-muted rounded animate-pulse w-48" />
                    <div className="h-8 bg-muted rounded animate-pulse w-24" />
                  </div>
                </>
              ) : (
                <>
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
                          setSearchTerm(e.target.value)
                          // Exit random mode when user starts typing
                          if (isRandomMode && e.target.value.trim()) {
                            setIsRandomMode(false)
                            setRevealedDiagnoses(new Set())
                          }
                        }}
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />

                      {/* Show Surprise Me button only when NOT in random mode */}
                      {!isRandomMode && (
                        <Button
                          variant="outline"
                          onClick={toggleRandomMode}
                          disabled={isLoading}
                          className="px-6 w-full sm:w-auto"
                        >
                          <Shuffle className="h-4 w-4 mr-2 opacity-70" />
                          Surprise Me!
                        </Button>
                      )}

                      <Button
                        onClick={handleSearch}
                        disabled={isLoading || (isRandomMode && !searchTerm.trim())}
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

                      {/* New Random Button - only show in random mode */}
                      {isRandomMode && (
                        <Button
                          variant="outline"
                          onClick={generateNewRandomSlides}
                          disabled={isLoading}
                          className="px-4 w-full sm:w-auto"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          New Surprise
                        </Button>
                      )}
                    </div>

                  </div>



                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="repository-filter">Web Repository</Label>
                      <Select
                        value={selectedRepository}
                        onValueChange={(value) => handleFilterChange('repository', value)}
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
                        onValueChange={(value) => handleFilterChange('category', value)}
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
                        onValueChange={(value) => handleFilterChange('organSystem', value)}
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
                              Showing {filteredSlides.length.toLocaleString()} random slides
                            </span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-4 w-4" />
                            <span>
                              Showing {filteredSlides.length.toLocaleString()} of {virtualSlidesData.length.toLocaleString()} slides
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
                              Showing {filteredSlides.length.toLocaleString()} random slides
                            </span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-4 w-4" />
                            <span>
                              Showing {filteredSlides.length.toLocaleString()} of {virtualSlidesData.length.toLocaleString()} slides
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
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
                          <span className="hidden md:inline lg:hidden">Diagnosis</span>
                          <span className="hidden lg:inline">Diagnosis</span>
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
      ) : filteredSlides.length > 0 && (
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
                            {showDiagnoses ? 'Diagnosis' : 'Slide Info'}
                          </span>
                          <span className="hidden lg:inline">
                            {showDiagnoses ? 'Diagnosis' : 'Slide Info'}
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
                      {paginatedSlides.map((slide, index) => (
                        <SlideRow
                          key={`${slide.id}-${index}`}
                          slide={slide}
                          index={index}
                          showDiagnoses={showDiagnoses}
                          isRevealed={revealedDiagnoses.has(slide.id)}
                          onToggleReveal={toggleDiagnosisReveal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {!isRandomMode && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredSlides.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(newItemsPerPage) => {
                      setItemsPerPage(newItemsPerPage)
                      setCurrentPage(1)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* No Results */}
      {filteredSlides.length === 0 && !isLoading && !isInitialLoading && (
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

      {/* Content Disclaimer Section */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-sm text-muted-foreground text-center">
            <span className="font-medium text-foreground">Content Disclaimer:</span>
            <span className="ml-2">
              This tool provides links to third-party whole slide image (WSI) repositories. We do not host, store, or claim ownership of any of the content linked. All copyrights remain with the respective content owners. Accessing and using external content is subject to each source's terms and conditions. No affiliation or endorsement is implied.
            </span>
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
