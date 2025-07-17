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
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import FloatingCharacter from '@/shared/components/common/dr-albright'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

// Import the filtered virtual slides data (unknown diagnoses removed)
import virtualSlidesDataRaw from '@/data/virtual-slides-filtered.json'

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

// Type cast the imported data
const virtualSlidesData = virtualSlidesDataRaw as VirtualSlide[]

export default function VirtualSlidesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRepository, setSelectedRepository] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedOrganSystem, setSelectedOrganSystem] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [itemsPerPage, setItemsPerPage] = useState(30)

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

  // Get unique values for filters
  const repositories = useMemo(() => getUniqueRepositories(virtualSlidesData), [])
  const categories = useMemo(() => getUniqueCategories(virtualSlidesData), [])
  const organSystems = useMemo(() => getUniqueOrganSystems(virtualSlidesData), [])

  // Dynamic acronym mapping and search index
  const acronymMap = useMemo(() => createAcronymMap(virtualSlidesData), [])
  const searchIndex = useMemo(() => createSearchIndex(virtualSlidesData), [])

  // Search function using utility
  const searchSlidesCallback = useCallback((searchTerm: string): VirtualSlide[] => {
    return searchSlides(searchTerm, searchIndex, acronymMap)
  }, [searchIndex, acronymMap])

  // Filtering logic using utilities
  const filteredSlides = useMemo(() => {
    // Start with search results
    const searchResults = searchSlidesCallback(debouncedSearchTerm)

    // Apply filters
    return applyFilters(searchResults, selectedRepository, selectedCategory, selectedOrganSystem)
  }, [debouncedSearchTerm, selectedRepository, selectedCategory, selectedOrganSystem, searchSlidesCallback])

  // Pagination
  const totalPages = Math.ceil(filteredSlides.length / itemsPerPage)
  const paginatedSlides = filteredSlides.slice(
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
    
    setTimeout(() => setIsLoading(false), 300)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedRepository('all')
    setSelectedCategory('all')
    setSelectedOrganSystem('all')
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-8 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/10 via-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.15),transparent_25%)]" />

        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Virtual Slide Search Engine
              </h1>
              <p className="text-lg text-muted-foreground">
                Search and explore thousands of virtual pathology slides from leading institutions worldwide.
                Find cases by diagnosis, organ system, repository, and more.
              </p>
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
            </div>

            {/* Character - hidden on mobile */}
            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Repository Logos Section */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 overflow-x-auto">
            {[
              { src: '/logos/university-of-leeds-logo.png', alt: 'University of Leeds' },
              { src: '/logos/mgh-logo.png', alt: 'MGH Pathology' },
              { src: '/logos/path-presenter-logo.png', alt: 'PathPresenter' },
              { src: '/logos/rosai-collection-logo.png', alt: 'Rosai Collection' },
              { src: '/logos/university-of-toronto-logo.png', alt: 'University of Toronto LMP' },
              { src: '/logos/hematopathology-etutorial-logo.png', alt: 'Hematopathology eTutorial' },
              { src: '/logos/recut-club-logo.png', alt: 'Recut Club' }
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
                      Search Virtual Slides
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="search-input"
                        placeholder="Search by diagnosis, patient info, repository, category, or organ system..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />
                      <Button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="px-6"
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
                      <Select value={selectedRepository} onValueChange={(value) => handleFilterChange('repository', value)}>
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
                      <Select value={selectedCategory} onValueChange={(value) => handleFilterChange('category', value)}>
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
                      <Select value={selectedOrganSystem} onValueChange={(value) => handleFilterChange('organSystem', value)}>
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

                  {/* Filter Summary and Clear */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Filter className="h-4 w-4" />
                      <span>
                        Showing {filteredSlides.length.toLocaleString()} of {virtualSlidesData.length.toLocaleString()} slides
                      </span>
                    </div>
                    <Button variant="outline" onClick={clearFilters} size="sm">
                      Clear Filters
                    </Button>
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
                        <th className="text-left p-4 font-semibold">Diagnosis & Patient Info</th>
                        <th className="text-left p-4 font-semibold">Repository</th>
                        <th className="text-left p-4 font-semibold">Category</th>
                        <th className="text-left p-4 font-semibold">Details</th>
                        <th className="text-left p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <LoadingSkeleton />
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
                        <th className="text-left p-4 font-semibold">Diagnosis & Patient Info</th>
                        <th className="text-left p-4 font-semibold">Repository</th>
                        <th className="text-left p-4 font-semibold">Category</th>
                        <th className="text-left p-4 font-semibold">Details</th>
                        <th className="text-left p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSlides.map((slide, index) => (
                        <SlideRow key={`${slide.id}-${index}`} slide={slide} index={index} />
                      ))}
                    </tbody>
                  </table>
                </div>

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

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
