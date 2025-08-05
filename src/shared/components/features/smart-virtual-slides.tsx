// src/shared/components/features/smart-virtual-slides.tsx
/**
 * Smart Virtual Slides component with progressive loading
 * Demonstrates the "what you use is what you get" approach
 */

import { useState, useCallback, useEffect } from 'react'
import { useSmartSlides } from '@/shared/hooks/use-smart-slides'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { 
  Loader2, 
  ChevronDown, 
  Database, 
  Zap, 
  TrendingUp,
  Search,
  Info
} from 'lucide-react'

interface SmartVirtualSlidesProps {
  className?: string
}

export function SmartVirtualSlides({ className }: SmartVirtualSlidesProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const {
    slides,
    isLoading,
    error,
    pagination,
    metadata,
    actions,
    strategy
  } = useSmartSlides({
    search: debouncedSearch || undefined,
    initialLimit: 50
  })

  const handleLoadMore = useCallback(() => {
    actions.loadNextPage()
  }, [actions])

  const handleSwitchToFull = useCallback(() => {
    actions.switchToFullDataset()
  }, [actions])

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Failed to load virtual slides: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Strategy Info Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {strategy === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {strategy === 'paginated' && <TrendingUp className="h-5 w-5 text-blue-500" />}
            {strategy === 'full-dataset' && <Database className="h-5 w-5 text-green-500" />}
            Smart Virtual Slides Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search slides..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Strategy Status */}
          <div className="flex flex-wrap gap-3 items-center">
            <Badge variant={strategy === 'full-dataset' ? 'default' : 'secondary'}>
              {strategy === 'loading' && 'Loading...'}
              {strategy === 'paginated' && `Paginated (Page ${pagination.currentPage})`}
              {strategy === 'full-dataset' && 'Full Dataset'}
            </Badge>
            
            <span className="text-sm text-muted-foreground">
              {slides.length.toLocaleString()} slides loaded
            </span>
            
            {metadata?.sizeReduction && metadata.sizeReduction !== '0%' && (
              <Badge variant="outline" className="text-green-600">
                {metadata.sizeReduction} size reduction
              </Badge>
            )}
            
            {metadata?.performance?.egressCost && (
              <Badge variant="outline" className="text-blue-600">
                <Zap className="h-3 w-3 mr-1" />
                {metadata.performance.egressCost}
              </Badge>
            )}
          </div>

          {/* Performance Info */}
          {metadata && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p><strong>Strategy:</strong> {metadata.payloadStrategy}</p>
                  <p><strong>Total Available:</strong> {metadata.originalTotal?.toLocaleString()} slides</p>
                  {strategy === 'paginated' && (
                    <p><strong>Pages:</strong> {pagination.currentPage} of {pagination.totalPages}</p>
                  )}
                  {metadata.performance?.strategy && (
                    <p><strong>Loading:</strong> {metadata.performance.strategy}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {strategy === 'paginated' && pagination.canLoadMore && (
          <Button 
            onClick={handleLoadMore}
            disabled={pagination.isLoadingMore}
            variant="outline"
          >
            {pagination.isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-2" />
            )}
            Load Next {metadata?.pagination?.limit || 50} Slides
          </Button>
        )}
        
        {strategy === 'paginated' && (
          <Button 
            onClick={handleSwitchToFull}
            variant="default"
          >
            <Database className="h-4 w-4 mr-2" />
            Switch to Full Dataset
          </Button>
        )}
        
        {slides.length > 0 && (
          <Button 
            onClick={actions.reset}
            variant="ghost"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Slides Display */}
      <Card>
        <CardHeader>
          <CardTitle>
            Loaded Slides ({slides.length.toLocaleString()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading slides...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {slides.slice(0, 100).map((slide, index) => (
                <div key={slide.id} className="flex items-center gap-3 p-2 border rounded text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-8">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{slide.diagnosis || 'No diagnosis'}</p>
                    <p className="text-muted-foreground text-xs">
                      {slide.repository} • {slide.category}
                    </p>
                  </div>
                </div>
              ))}
              {slides.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... and {(slides.length - 100).toLocaleString()} more slides
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}