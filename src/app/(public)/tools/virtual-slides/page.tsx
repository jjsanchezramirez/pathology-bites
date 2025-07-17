'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import {
  Search,
  ExternalLink,
  Microscope,
  Filter,
  Eye,
  FileText,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import FloatingCharacter from '@/shared/components/common/dr-albright'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

// Import the filtered virtual slides data (unknown diagnoses removed)
import virtualSlidesDataRaw from '@/data/virtual-slides-filtered.json'

interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

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

  
  const itemsPerPage = 50

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
  const repositories = useMemo(() => {
    const repos = [...new Set(virtualSlidesData.map((slide: VirtualSlide) => slide.repository))]
    return repos.filter(repo => repo && repo.trim() !== '').sort()
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(virtualSlidesData.map((slide: VirtualSlide) => slide.category))]
    return cats.filter(cat => cat && cat.trim() !== '').sort()
  }, [])

  const organSystems = useMemo(() => {
    const systems = [...new Set(virtualSlidesData.map((slide: VirtualSlide) => slide.subcategory))]
    return systems.filter(system => system && system.trim() !== '').sort()
  }, [])

  // Dynamic acronym mapping based on first letters of words (diagnosis only)
  const acronymMap = useMemo(() => {
    const map = new Map<string, string[]>()

    // Helper function to generate acronym from phrase
    const generateAcronym = (phrase: string): string => {
      return phrase
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0))
        .join('')
    }

    // Collect all unique diagnoses only (for performance)
    const allDiagnoses = new Set<string>()

    virtualSlidesData.forEach(slide => {
      if (slide.diagnosis) allDiagnoses.add(slide.diagnosis.toLowerCase())
    })

    // Build bidirectional mapping for diagnosis phrases only
    Array.from(allDiagnoses).forEach(diagnosis => {
      // Skip very short phrases or single words
      if (diagnosis.split(/\s+/).length < 2) return

      const acronym = generateAcronym(diagnosis)

      // Only create mappings for acronyms that are 2+ characters
      if (acronym.length >= 2) {
        // Map acronym to full phrase
        if (!map.has(acronym)) {
          map.set(acronym, [])
        }
        if (!map.get(acronym)!.includes(diagnosis)) {
          map.get(acronym)!.push(diagnosis)
        }

        // Map full phrase to acronym
        if (!map.has(diagnosis)) {
          map.set(diagnosis, [])
        }
        if (!map.get(diagnosis)!.includes(acronym)) {
          map.get(diagnosis)!.push(acronym)
        }
      }
    })

    return map
  }, [])

  // Create search index for better performance (diagnosis only)
  const searchIndex = useMemo(() => {
    return virtualSlidesData.map((slide: VirtualSlide) => {
      const diagnosis = slide.diagnosis?.toLowerCase() || ''

      return {
        slide,
        diagnosis
      }
    })
  }, [])

  // Improved search scoring function (diagnosis only, prioritize exact matches and acronyms)
  const calculateSearchScore = (indexItem: { slide: VirtualSlide; diagnosis: string }, originalTerm: string): number => {
    const diagnosis = indexItem.diagnosis.toLowerCase()
    const searchTerm = originalTerm.toLowerCase().trim()

    if (!diagnosis || !searchTerm) return 0

    // Generate acronym from diagnosis
    const diagnosisWords = diagnosis.split(/\s+/).filter(word => word.length > 0)
    const diagnosisAcronym = diagnosisWords.map(word => word.charAt(0)).join('')

    // Check for exact matches (highest priority)
    if (diagnosis === searchTerm) {
      return 10000 // Perfect exact match
    }

    // Check for acronym matches (very high priority)
    if (diagnosisAcronym === searchTerm) {
      return 5000 // Acronym match
    }

    // Check if search term is an acronym that expands to this diagnosis
    if (acronymMap.has(searchTerm) && acronymMap.get(searchTerm)?.includes(diagnosis)) {
      return 5000 // Reverse acronym match
    }

    // Check for phrase matches (high priority)
    if (diagnosis.includes(searchTerm)) {
      // Bonus for word boundary matches
      const wordBoundaryRegex = new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (wordBoundaryRegex.test(diagnosis)) {
        return 1000 // Whole word/phrase match
      }

      // Bonus for starting with the term
      if (diagnosis.startsWith(searchTerm)) {
        return 500 // Starts with term
      }

      return 100 // Contains term
    }

    // Check individual words for partial matches
    const searchWords = searchTerm.split(/\s+/)
    const diagnosisWordsLower = diagnosisWords
    let wordMatchScore = 0
    let matchedWords = 0

    for (const searchWord of searchWords) {
      for (const diagWord of diagnosisWordsLower) {
        if (diagWord === searchWord) {
          wordMatchScore += 50
          matchedWords++
          break
        } else if (diagWord.startsWith(searchWord)) {
          wordMatchScore += 25
          matchedWords++
          break
        } else if (diagWord.includes(searchWord)) {
          wordMatchScore += 10
          matchedWords++
          break
        }
      }
    }

    // Bonus for matching multiple words
    if (matchedWords > 1) {
      wordMatchScore *= matchedWords
    }

    return wordMatchScore
  }

  // Filter and search logic with improved scoring and acronym support
  const filteredSlides = useMemo(() => {
    let filteredIndex = searchIndex

    // Apply repository filter
    if (selectedRepository !== 'all') {
      filteredIndex = filteredIndex.filter(item => item.slide.repository === selectedRepository)
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filteredIndex = filteredIndex.filter(item => item.slide.category === selectedCategory)
    }

    // Apply organ system filter
    if (selectedOrganSystem !== 'all') {
      filteredIndex = filteredIndex.filter(item => item.slide.subcategory === selectedOrganSystem)
    }

    // Apply search term with improved scoring (diagnosis only)
    if (debouncedSearchTerm.trim()) {
      const searchTermLower = debouncedSearchTerm.toLowerCase().trim()

      // Filter items that contain the search term or related acronyms
      const matchingItems = filteredIndex.filter(item => {
        const diagnosis = item.diagnosis.toLowerCase()

        // Direct text match
        if (diagnosis.includes(searchTermLower)) {
          return true
        }

        // Check if search term is an acronym that matches this diagnosis
        const diagnosisWords = diagnosis.split(/\s+/).filter(word => word.length > 0)
        const diagnosisAcronym = diagnosisWords.map(word => word.charAt(0)).join('')
        if (diagnosisAcronym === searchTermLower) {
          return true
        }

        // Check if search term expands to this diagnosis via acronym map
        if (acronymMap.has(searchTermLower) && acronymMap.get(searchTermLower)?.includes(diagnosis)) {
          return true
        }

        return false
      })

      // Sort by relevance score (highest first)
      const scoredItems = matchingItems
        .map(item => ({
          item,
          score: calculateSearchScore(item, debouncedSearchTerm)
        }))
        .sort((a, b) => b.score - a.score)

      return scoredItems.map(scoredItem => scoredItem.item.slide)
    }

    return filteredIndex.map(item => item.slide)
  }, [debouncedSearchTerm, selectedRepository, selectedCategory, selectedOrganSystem, searchIndex, acronymMap])

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
                    <tbody>
                      {Array.from({ length: 10 }).map((_, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="p-4">
                            <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
                          </td>
                          <td className="p-4">
                            <div className="space-y-2">
                              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="h-6 bg-muted rounded animate-pulse w-20" />
                          </td>
                          <td className="p-4">
                            <div className="h-4 bg-muted rounded animate-pulse w-24" />
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="h-3 bg-muted rounded animate-pulse w-16" />
                              <div className="h-3 bg-muted rounded animate-pulse w-20" />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <div className="h-8 bg-muted rounded animate-pulse w-20" />
                              <div className="h-8 bg-muted rounded animate-pulse w-16" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
                        <tr key={`${slide.id}-${index}`} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          {/* Preview Image */}
                          <td className="p-4">
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              {slide.preview_image_url ? (
                                <Image
                                  src={slide.preview_image_url}
                                  alt={slide.diagnosis}
                                  width={64}
                                  height={64}
                                  className="object-cover w-full h-full"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    target.nextElementSibling?.classList.remove('hidden')
                                  }}
                                />
                              ) : null}
                              <div className={`flex items-center justify-center w-full h-full ${slide.preview_image_url ? 'hidden' : ''}`}>
                                <Microscope className="h-6 w-6 text-muted-foreground" />
                              </div>
                            </div>
                          </td>

                          {/* Diagnosis & Patient Info */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <h3 className="font-medium text-sm leading-tight line-clamp-3">
                                {slide.diagnosis}
                              </h3>
                              {slide.patient_info && (
                                <p className="text-xs text-muted-foreground">
                                  {slide.patient_info}
                                </p>
                              )}
                              {slide.clinical_history && (
                                <p className="text-xs text-muted-foreground italic">
                                  {slide.clinical_history}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Repository */}
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {slide.repository}
                            </Badge>
                          </td>

                          {/* Category */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{slide.category}</p>
                              {slide.subcategory && slide.subcategory !== slide.category && (
                                <p className="text-xs text-muted-foreground">{slide.subcategory}</p>
                              )}
                            </div>
                          </td>

                          {/* Details */}
                          <td className="p-4">
                            <div className="space-y-1">
                              {slide.stain_type && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Eye className="h-3 w-3" />
                                  <span>{slide.stain_type}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex gap-2">
                              {slide.slide_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.slide_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View Slide
                                  </a>
                                </Button>
                              )}

                              {/* Repository-specific second button */}
                              {slide.repository === 'Leeds University' && slide.case_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.case_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Case
                                  </a>
                                </Button>
                              )}

                              {slide.repository === 'University of Toronto LMP' && slide.case_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.case_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Case
                                  </a>
                                </Button>
                              )}

                              {slide.repository === 'Hematopathology eTutorial' && slide.other_urls && slide.other_urls.length > 0 && slide.other_urls[0] && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.other_urls[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Study Notes
                                  </a>
                                </Button>
                              )}

                              {slide.repository === 'Rosai Collection' && slide.case_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.case_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Seminar Info
                                  </a>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="border-t p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSlides.length)} of {filteredSlides.length} results
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="w-8 h-8 p-0"
                        >
                          &lt;&lt;
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="w-8 h-8 p-0"
                        >
                          &gt;&gt;
                        </Button>
                      </div>
                    </div>
                  </div>
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

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
