'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { RefreshCw, ExternalLink, Info, Eye } from 'lucide-react'
import { WSIEmbeddingViewer } from '@/shared/components/common/wsi-viewer'
import { useOptimizedVirtualSlides } from '@/shared/hooks/use-optimized-quiz-data'
import { VirtualSlide } from '@/shared/types/virtual-slides'

export function WSIEmbeddingTab() {
  const [allSlides, setAllSlides] = useState<VirtualSlide[]>([])
  const [repositories, setRepositories] = useState<string[]>([])
  const [selectedRepository, setSelectedRepository] = useState<string>('')
  const [currentSlide, setCurrentSlide] = useState<VirtualSlide | null>(null)
  const [loading, setLoading] = useState(false)

  // Load slides using optimized hook with caching
  const { data: slidesData, isLoading: slidesLoading, error: slidesError } = useOptimizedVirtualSlides(
    1, // page
    1000, // limit - get more slides for repository analysis
    {} // no filters initially
  )

  useEffect(() => {
    if (slidesData?.data) {
      const slides = slidesData.data
      setAllSlides(slides)

      const uniqueRepos = [...new Set(slides.map((slide: VirtualSlide) => slide.repository))]
        .filter(Boolean)
        .filter((repo: unknown) => typeof repo === 'string' && !repo.toLowerCase().includes('debug')) as string[]

      setRepositories(uniqueRepos)
      if (uniqueRepos.length > 0) {
        setSelectedRepository(uniqueRepos[0])
      }
    }

    if (slidesError) {
      console.error('Failed to load slides:', slidesError)
    }
  }, [slidesData, slidesError])

  // Load a specific slide
  const loadSlide = useCallback((slide: VirtualSlide) => {
    console.log('🔄 Loading slide:', slide.diagnosis)
    setCurrentSlide(slide)
  }, [])

  const loadRandomSlide = useCallback(() => {
    const repoSlides = selectedRepository
      ? allSlides.filter(slide => slide.repository === selectedRepository)
      : allSlides

    if (repoSlides.length === 0) return

    setLoading(true)
    const randomSlide = repoSlides[Math.floor(Math.random() * repoSlides.length)]

    loadSlide(randomSlide)
    setLoading(false)
  }, [allSlides, selectedRepository, loadSlide])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">WSI Embedding Debug Interface</h3>
        <p className="text-sm text-muted-foreground">
          Two-step WSI viewer: OpenSeadragon initialization + embedding functionality
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - WSI Viewer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              WSI Viewer

              {currentSlide && (
                <a
                  href={currentSlide.slide_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-blue-500 hover:text-blue-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentSlide ? (
              <WSIEmbeddingViewer
                url={currentSlide.slide_url}
                filename={currentSlide.diagnosis}
                diagnosis={currentSlide.diagnosis}
              />
            ) : (
              <div className="aspect-video border rounded-lg flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-2">
                  <Info className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-muted-foreground">No slide selected</p>
                  <p className="text-xs text-muted-foreground">Click "Load Random Slide" to start</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Repository Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Repository Selection & Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Repository ({repositories.length} available)
              </label>
              <Select value={selectedRepository} onValueChange={setSelectedRepository}>
                <SelectTrigger>
                  <SelectValue placeholder="Select repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map(repo => {
                    const count = allSlides.filter(s => s.repository === repo).length
                    return (
                      <SelectItem key={repo} value={repo}>
                        {repo} ({count} slides)
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={loadRandomSlide}
              disabled={loading || !selectedRepository}
              className="w-full"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Load Random Slide
            </Button>

            {/* Current slide info */}
            {currentSlide && (
              <div className="space-y-3 pt-4 border-t">
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Repository</label>
                    <Badge variant="outline" className="ml-2">
                      {currentSlide.repository}
                    </Badge>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Slide Name</label>
                    <p className="text-sm font-medium">{currentSlide.diagnosis}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Diagnosis</label>
                    <p className="text-sm">{currentSlide.diagnosis}</p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <label className="text-xs font-medium text-muted-foreground">Debug Info</label>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>• Two-step process: OpenSeadragon → Embedding</p>
                    <p>• Dynamic configuration based on repository</p>
                    <p>• Fallback handling for blocked content</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}