'use client'

import { useState, useMemo } from 'react'
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
  User,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import FloatingCharacter from '@/shared/components/common/dr-albright'

// Import the full unified virtual slides data
import virtualSlidesData from '@/data/virtual-slides-unified.json'

interface VirtualSlide {
  id: string
  title: string
  repository: string
  category: string
  organ_system: string
  diagnosis: string
  clinical_details: string
  patient_info: string
  slide_urls: string[]
  preview_image_urls: string[]
  case_url: string
  stain: string
  specimen_type: string
  age: string | null
  gender: string | null
  source_data: any
}

export default function VirtualSlidesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRepository, setSelectedRepository] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedOrganSystem, setSelectedOrganSystem] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  const itemsPerPage = 50

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
    const systems = [...new Set(virtualSlidesData.map((slide: VirtualSlide) => slide.organ_system))]
    return systems.filter(system => system && system.trim() !== '').sort()
  }, [])

  // Enhanced search scoring function
  const calculateSearchScore = (slide: VirtualSlide, searchTerm: string): number => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return 0

    let score = 0
    const fields = [
      { text: slide.title.toLowerCase(), weight: 10 },
      { text: slide.diagnosis.toLowerCase(), weight: 8 },
      { text: slide.clinical_details.toLowerCase(), weight: 4 },
      { text: slide.patient_info.toLowerCase(), weight: 2 },
      { text: slide.repository.toLowerCase(), weight: 1 },
      { text: slide.category.toLowerCase(), weight: 3 },
      { text: slide.organ_system.toLowerCase(), weight: 5 }
    ]

    for (const field of fields) {
      const text = field.text

      // Exact match (highest priority)
      if (text === term) {
        score += field.weight * 100
        continue
      }

      // Whole word match (high priority)
      const wordBoundaryRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (wordBoundaryRegex.test(text)) {
        score += field.weight * 50
        continue
      }

      // Starts with term (medium-high priority)
      if (text.startsWith(term)) {
        score += field.weight * 25
        continue
      }

      // Contains term as substring (lower priority)
      if (text.includes(term)) {
        score += field.weight * 10
      }
    }

    return score
  }

  // Filter and search logic with enhanced scoring
  const filteredSlides = useMemo(() => {
    let filtered = virtualSlidesData as VirtualSlide[]

    // Apply repository filter
    if (selectedRepository !== 'all') {
      filtered = filtered.filter(slide => slide.repository === selectedRepository)
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(slide => slide.category === selectedCategory)
    }

    // Apply organ system filter
    if (selectedOrganSystem !== 'all') {
      filtered = filtered.filter(slide => slide.organ_system === selectedOrganSystem)
    }

    // Apply search term with enhanced scoring
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()

      // First filter slides that match the search term
      const matchingSlides = filtered.filter(slide =>
        slide.title.toLowerCase().includes(term) ||
        slide.diagnosis.toLowerCase().includes(term) ||
        slide.clinical_details.toLowerCase().includes(term) ||
        slide.patient_info.toLowerCase().includes(term) ||
        slide.repository.toLowerCase().includes(term) ||
        slide.category.toLowerCase().includes(term) ||
        slide.organ_system.toLowerCase().includes(term)
      )

      // Then sort by relevance score (highest first)
      filtered = matchingSlides
        .map(slide => ({
          slide,
          score: calculateSearchScore(slide, searchTerm)
        }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.slide)
    }

    return filtered
  }, [searchTerm, selectedRepository, selectedCategory, selectedOrganSystem])

  // Pagination
  const totalPages = Math.ceil(filteredSlides.length / itemsPerPage)
  const paginatedSlides = filteredSlides.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSearch = () => {
    setIsLoading(true)
    setCurrentPage(1)
    // Simulate loading delay
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
      <section className="relative py-20 overflow-hidden">
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
      <section className="py-8 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
            {/* Leeds University */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity bg-opacity-100">
              <Image
                src="/logos/university-of-leeds-logo.png"
                alt="University of Leeds"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>

            {/* MGH Pathology */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/mgh-logo.png"
                alt="MGH Pathology"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>

            {/* PathPresenter */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/path-presenter-logo.png"
                alt="PathPresenter"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>

            {/* Rosai Collection */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/rosai-collection-logo.png"
                alt="Rosai Collection"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>

            {/* University of Toronto */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/university-of-toronto-logo.png"
                alt="University of Toronto LMP"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>

            {/* Hematopathology eTutorial */}
            <div className="flex items-center justify-center h-16 w-auto opacity-50 hover:opacity-100 transition-opacity">
              <Image
                src="/logos/hematopathology-etutorial-logo.png"
                alt="Hematopathology eTutorial"
                width={200}
                height={80}
                className="object-contain h-full w-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-6xl">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Search Bar */}
              <div className="space-y-4">
                <Label htmlFor="search-input" className="text-lg font-semibold">
                  Search Virtual Slides
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="search-input"
                    placeholder="Search by diagnosis, title, clinical details, or repository..."
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
                  <Select value={selectedRepository} onValueChange={setSelectedRepository}>
                    <SelectTrigger>
                      <SelectValue placeholder="All repositories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Repositories</SelectItem>
                      {repositories.map((repo, index) => (
                        <SelectItem key={`repo-${index}-${repo}`} value={repo}>{repo}</SelectItem>
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
                        <SelectItem key={`cat-${index}-${category}`} value={category}>{category}</SelectItem>
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
                        <SelectItem key={`sys-${index}-${system}`} value={system}>{system}</SelectItem>
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
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {filteredSlides.length > 0 && (
        <section className="relative py-16">
          <div className="container px-4 mx-auto max-w-6xl">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-semibold">Preview</th>
                        <th className="text-left p-4 font-semibold">Title & Diagnosis</th>
                        <th className="text-left p-4 font-semibold">Repository</th>
                        <th className="text-left p-4 font-semibold">Category</th>
                        <th className="text-left p-4 font-semibold">Patient Info</th>
                        <th className="text-left p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSlides.map((slide, index) => (
                        <tr key={slide.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          {/* Preview Image */}
                          <td className="p-4">
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                              {slide.preview_image_urls.length > 0 ? (
                                <Image
                                  src={slide.preview_image_urls[0]}
                                  alt={slide.title}
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
                              <div className={`flex items-center justify-center w-full h-full ${slide.preview_image_urls.length > 0 ? 'hidden' : ''}`}>
                                <Microscope className="h-6 w-6 text-muted-foreground" />
                              </div>
                            </div>
                          </td>

                          {/* Title & Diagnosis */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                {slide.title}
                              </h3>
                              {slide.diagnosis && slide.diagnosis !== slide.title && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {slide.diagnosis}
                                </p>
                              )}
                              {slide.clinical_details && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {slide.clinical_details}
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
                              {slide.organ_system && slide.organ_system !== slide.category && (
                                <p className="text-xs text-muted-foreground">{slide.organ_system}</p>
                              )}
                            </div>
                          </td>

                          {/* Patient Info */}
                          <td className="p-4">
                            <div className="space-y-1">
                              {slide.patient_info && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{slide.patient_info}</span>
                                </div>
                              )}
                              {slide.stain && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Eye className="h-3 w-3" />
                                  <span>{slide.stain}</span>
                                </div>
                              )}
                              {slide.specimen_type && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  <span>{slide.specimen_type}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex gap-2">
                              {slide.slide_urls.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="text-xs"
                                >
                                  <a
                                    href={slide.slide_urls[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View Slide
                                  </a>
                                </Button>
                              )}
                              {slide.case_url && (
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
      {filteredSlides.length === 0 && !isLoading && (
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
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Our Learning Community</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Ready to take your pathology education to the next level? Create a free account and access our comprehensive question bank, interactive quizzes, and study tools.
          </p>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 transform hover:scale-105
                        transition-all duration-300 ease-in-out"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
