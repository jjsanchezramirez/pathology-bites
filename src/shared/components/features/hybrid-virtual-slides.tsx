/**
 * Hybrid Virtual Slides Component
 *
 * Uses lightweight search index for fast search/filtering
 * Loads full slide details on-demand when needed
 */

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useHybridVirtualSlides } from '@/shared/hooks/use-hybrid-virtual-slides'
import { VirtualSlide } from '@/shared/types/virtual-slides'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  Loader2,
  Search,
  Shuffle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Database,
  Zap
} from 'lucide-react'

interface HybridVirtualSlidesProps {
  className?: string
}

export function HybridVirtualSlides({ className }: HybridVirtualSlidesProps) {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRepository, setSelectedRepository] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isRandomMode, setIsRandomMode] = useState(false)

  // UI state
  const [currentPage, setCurrentPage] = useState(1)
  const [showDiagnoses, setShowDiagnoses] = useState(false)
  const [revealedDiagnoses, setRevealedDiagnoses] = useState<Set<string>>(new Set())
  const [loadedSlideDetails, setLoadedSlideDetails] = useState<Map<string, VirtualSlide>>(new Map())

  // Randomization key to regenerate random slides
  const [randomKey, setRandomKey] = useState(0)

  const itemsPerPage = 20

  // Use hybrid hook
  const {
    searchIndex,
    metadata,
    filteredSlides,
    slideDetails,
    isLoadingIndex,
    isLoadingDetails,
    loadSlideDetails,
    generateRandomSlides,
    error
  } = useHybridVirtualSlides({
    search: searchTerm,
    repository: selectedRepository,
    category: selectedCategory
  })

  // Get current page slides
  const currentSlides = useMemo(() => {
    if (isRandomMode) {
      // Include randomKey to force recalculation when user requests new random set
      void randomKey
      return generateRandomSlides(itemsPerPage)
    }

    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredSlides.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredSlides, currentPage, itemsPerPage, isRandomMode, generateRandomSlides, randomKey])

  // Load full details for current page slides when needed
  const loadCurrentPageDetails = useCallback(async () => {
    const slideIds = currentSlides.map(slide => slide.id)
    const uncachedIds = slideIds.filter(id => !loadedSlideDetails.has(id))

    if (uncachedIds.length > 0) {
      try {
        const details = await loadSlideDetails(uncachedIds)
        setLoadedSlideDetails(prev => {
          const newMap = new Map(prev)
          details.forEach(slide => newMap.set(slide.id, slide))
          return newMap
        })
      } catch (err) {
        console.error('Failed to load slide details:', err)
      }
    }
  }, [currentSlides, loadedSlideDetails, loadSlideDetails])

  // Auto-load details for current page
  useEffect(() => {
    if (currentSlides.length > 0) {
      loadCurrentPageDetails()
    }
  }, [currentSlides, loadCurrentPageDetails])

  // Pagination calculations
  const totalPages = Math.ceil(filteredSlides.length / itemsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Event handlers
  const handleSearch = useCallback(() => {
    setCurrentPage(1)
    setIsRandomMode(false)
  }, [])

  const handleRandomMode = useCallback(() => {
    setIsRandomMode(!isRandomMode)
    setCurrentPage(1)
    setRevealedDiagnoses(new Set())
  }, [isRandomMode])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
    setRevealedDiagnoses(new Set()) // Clear revealed diagnoses on page change
  }, [])

  // Get slide with details (hybrid approach)
  const getSlideWithDetails = useCallback((slideIndex: any) => {
    const fullDetails = loadedSlideDetails.get(slideIndex.id)
    if (fullDetails) {
      return fullDetails
    }

    // Fallback to index data with placeholder for missing fields
    return {
      ...slideIndex,
      clinical_history: 'Loading...',
      preview_image_url: '',
      slide_url: '',
      case_url: '',
      other_urls: []
    } as VirtualSlide
  }, [loadedSlideDetails])

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>❌ Error loading virtual slides: {error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoadingIndex) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading search index...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Performance Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Hybrid Loading Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Search Index</p>
              <p className="font-medium">{searchIndex.length.toLocaleString()} slides</p>
            </div>
            <div>
              <p className="text-muted-foreground">Loaded Details</p>
              <p className="font-medium">{slideDetails.size} cached</p>
            </div>
            <div>
              <p className="text-muted-foreground">Current Results</p>
              <p className="font-medium">{filteredSlides.length.toLocaleString()} found</p>
            </div>
            <div>
              <p className="text-muted-foreground">Transfer Saved</p>
              <p className="font-medium text-green-600">~74% reduction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search diagnoses, repositories, categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <Button onClick={handleRandomMode} variant={isRandomMode ? "default" : "outline"}>
                <Shuffle className="h-4 w-4 mr-2" />
                {isRandomMode ? 'Exit Random' : 'Random Mode'}
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Repository</label>
                <select
                  value={selectedRepository}
                  onChange={(e) => setSelectedRepository(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">All Repositories</option>
                  {metadata?.repositories.map(repo => (
                    <option key={repo} value={repo}>{repo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">All Categories</option>
                  {metadata?.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {isRandomMode ? 'Random Slides' : 'Search Results'}
              <Badge variant="secondary" className="ml-2">
                {currentSlides.length} slides
              </Badge>
            </CardTitle>

            <Button
              onClick={() => setShowDiagnoses(!showDiagnoses)}
              variant="outline"
              size="sm"
            >
              {showDiagnoses ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showDiagnoses ? 'Hide' : 'Show'} Diagnoses
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {currentSlides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isLoadingIndex ? 'Loading...' : 'No slides found'}
            </div>
          ) : (
            <>
              {/* Slides Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {currentSlides.map((slideIndex) => {
                  const slide = getSlideWithDetails(slideIndex)
                  const isRevealed = revealedDiagnoses.has(slide.id)

                  return (
                    <Card key={slide.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <Badge variant="outline" className="text-xs">
                            {slide.repository}
                          </Badge>

                          <p className="text-sm text-muted-foreground">
                            {slide.category} • {slide.subcategory}
                          </p>

                          {showDiagnoses || isRevealed ? (
                            <p className="font-medium text-sm">{slide.diagnosis}</p>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevealedDiagnoses(prev => new Set([...prev, slide.id]))}
                              className="text-left p-0 h-auto font-normal"
                            >
                              Click to reveal diagnosis
                            </Button>
                          )}

                          <p className="text-xs text-muted-foreground">
                            {slide.stain_type} • {slide.age || 'Age unknown'} • {slide.gender || 'Gender unknown'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Pagination */}
              {!isRandomMode && totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!hasPrevPage}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasNextPage}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {isRandomMode && (
                <div className="text-center">
                  <Button onClick={() => setRandomKey(prev => prev + 1)}>
                    <Shuffle className="h-4 w-4 mr-2" />
                    Generate New Random Slides
                  </Button>
                </div>
              )}
            </>
          )}

          {isLoadingDetails && (
            <div className="text-center py-4">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              <span className="text-sm text-muted-foreground">Loading slide details...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
