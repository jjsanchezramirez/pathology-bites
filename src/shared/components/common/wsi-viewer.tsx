'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  Info,
  Download,
  RefreshCw
} from 'lucide-react'
import Image from 'next/image'

// Unified interface for all WSI slide types
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

// Props for the unified WSI viewer
interface WSIViewerProps {
  slide: VirtualSlide
  showMetadata?: boolean
  className?: string
}

// Props for embedding debug interface
interface WSIEmbeddingProps {
  url: string
  filename?: string
  diagnosis?: string
  className?: string
}

// Configuration for different WSI types and repositories
interface WSIConfig {
  canEmbed: boolean
  useOpenSeadragon: boolean
  embeddingStrategy: 'iframe' | 'openseadragon' | 'fallback'
  viewerUrl?: string
  reason?: string
}

// Helper function to try alternative URLs for blocked repositories
function tryAlternativeURL(originalUrl: string, slide?: VirtualSlide): string | null {
  try {
    const urlObj = new URL(originalUrl)
    const hostname = urlObj.hostname.toLowerCase()

    // Leeds Virtual Pathology: Try direct image URLs
    if (hostname.includes('virtualpathology.leeds.ac.uk')) {
      // Check if slide has preview_image_url that might be a direct image
      if (slide?.preview_image_url && slide.preview_image_url.includes('images.virtualpathology.leeds.ac.uk')) {
        return slide.preview_image_url
      }

      // Try to construct direct image URL from slide URL
      const pathMatch = originalUrl.match(/path=([^&]+)/)
      if (pathMatch) {
        const decodedPath = decodeURIComponent(pathMatch[1])
        const directImageUrl = `https://images.virtualpathology.leeds.ac.uk${decodedPath}?-1`
        return directImageUrl
      }
    }

    // University of Toronto: Try different viewer approaches
    if (hostname.includes('lmpimg.med.utoronto.ca')) {
      // For now, no alternative - these are already optimized viewer URLs
      return null
    }

    return null
  } catch {
    return null
  }
}

// Step 1: Dragon (OpenSeadragon) initialization and configuration
function getWSIConfig(url: string, repository?: string, slide?: VirtualSlide): WSIConfig {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Check if this is a raw WSI file
    const isRawWSI = /\.(svs|ndpi|scn|vms|vmu|mrxs|tiff?|czi|lsm|oib|oif)(\?|$)/i.test(url)
    
    // Repository-specific configurations
    if (hostname.includes('supabase.co') && isRawWSI) {
      return {
        canEmbed: true,
        useOpenSeadragon: true,
        embeddingStrategy: 'openseadragon',
        reason: 'Raw WSI file from Supabase storage'
      }
    }
    
    if (hostname.includes('upmc.edu')) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: 'iframe',
        reason: 'UPMC supports embedding'
      }
    }
    
    if (hostname.includes('pathpresenter.net') || hostname.includes('pathpresenter.blob.core.windows.net')) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: 'iframe',
        reason: 'PathPresenter supports embedding'
      }
    }
    
    if (hostname.includes('virtualpathology.leeds.ac.uk')) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: 'fallback',
        reason: 'Leeds Virtual Pathology blocks iframe embedding'
      }
    }

    if (hostname.includes('lmpimg.med.utoronto.ca') || hostname.includes('dlm.lmp.utoronto.ca')) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: 'fallback',
        reason: 'University of Toronto LMP blocks iframe embedding'
      }
    }

    if (hostname.includes('recutclub.com')) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: 'fallback',
        reason: 'Recut Club blocks iframe embedding'
      }
    }
    
    if (hostname.includes('hematopathologyetutorial.com')) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: 'iframe',
        reason: 'HematopathologyeTutorial supports embedding'
      }
    }

    if (hostname.includes('rosai.secondslide.com') || hostname.includes('rosaicollection.net')) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: 'iframe',
        reason: 'Rosai Collection supports embedding'
      }
    }
    
    // Default for raw WSI files
    if (isRawWSI) {
      return {
        canEmbed: true,
        useOpenSeadragon: true,
        embeddingStrategy: 'openseadragon',
        reason: 'Raw WSI file requires OpenSeadragon'
      }
    }
    
    // Default for web viewers
    return {
      canEmbed: true,
      useOpenSeadragon: false,
      embeddingStrategy: 'iframe',
      reason: 'Web-based viewer'
    }
  } catch {
    return {
      canEmbed: false,
      useOpenSeadragon: false,
      embeddingStrategy: 'fallback',
      reason: 'Invalid URL'
    }
  }
}

// Step 2: OpenSeadragon viewer component
interface OpenSeadragonViewerProps {
  url: string
  filename?: string
  diagnosis?: string
  onLoad?: () => void
  onError?: () => void
}

function InternalOpenSeadragonViewer({ url, filename, diagnosis, onError }: OpenSeadragonViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeOpenSeadragon = async () => {
      try {
        setLoading(true)

        if (!viewerRef.current) return

        // For now, show raw WSI file information since OpenSeadragon requires tile server
        // This is a placeholder for future OpenSeadragon integration
        setLoading(false)
        onError?.()

      } catch {
        setLoading(false)
        onError?.()
      }
    }

    const timer = setTimeout(initializeOpenSeadragon, 500)
    return () => clearTimeout(timer)
  }, [url, onError])

  const getFileInfo = (url: string) => {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    const extension = match ? match[1].toUpperCase() : 'Unknown'
    
    const supportedFormats = {
      'SVS': 'Aperio ScanScope Virtual Slide',
      'MRXS': '3DHISTECH MIRAX Virtual Slide',
      'NDPI': 'Hamamatsu NanoZoomer Digital Pathology Image',
      'SCN': 'Leica SCN Virtual Slide',
      'VMS': 'Hamamatsu Virtual Microscopy System',
      'VMU': 'Hamamatsu Virtual Microscopy System',
      'TIFF': 'Tagged Image File Format',
      'TIF': 'Tagged Image File Format',
      'CZI': 'Carl Zeiss Image',
      'LSM': 'Zeiss LSM Image',
      'OIB': 'Olympus Image Binary',
      'OIF': 'Olympus Image Format'
    }
    
    return {
      extension,
      description: supportedFormats[extension as keyof typeof supportedFormats] || 'Virtual Slide Image',
      isSupported: extension in supportedFormats
    }
  }

  const fileInfo = getFileInfo(url)
  const displayFilename = filename || url.split('/').pop() || 'Virtual Slide'

  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const downloadFile = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = displayFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-muted-foreground">Initializing OpenSeadragon...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center space-y-4 p-6">
      {/* File Icon */}
      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
        <div className="text-blue-600 font-bold text-sm">
          {fileInfo.extension}
        </div>
      </div>

      {/* File Info */}
      <div className="space-y-2">
        <h3 className="font-medium text-lg">
          {diagnosis || 'Virtual Slide Image'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {fileInfo.description}
        </p>
        <p className="text-xs text-muted-foreground">
          {displayFilename}
        </p>
      </div>

      {/* Status */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-left">
        <div className="flex items-start gap-2 mb-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-blue-800 mb-1">Raw WSI File</div>
            <div className="text-blue-700 space-y-1 text-xs">
              <div>• This is a raw whole slide imaging file</div>
              <div>• OpenSeadragon viewer requires a tile server for full functionality</div>
              <div>• For full viewing, use: QuPath, ImageJ with Bio-Formats, or Aperio ImageScope</div>
              <div>• You can download the file or open it directly</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button onClick={openInNewTab} className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          Open File
        </Button>
        <Button onClick={downloadFile} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {/* Recommended Software */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
        <div className="font-medium mb-2">Recommended WSI Viewers:</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-left">
          <div>
            <div className="font-medium">QuPath</div>
            <div>Open-source bioimage analysis</div>
          </div>
          <div>
            <div className="font-medium">ImageJ + Bio-Formats</div>
            <div>Scientific image processing</div>
          </div>
          <div>
            <div className="font-medium">Aperio ImageScope</div>
            <div>Commercial WSI viewer</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Iframe viewer component
interface IframeViewerProps {
  url: string
  title: string
  onLoad?: () => void
  onError?: () => void
  loaded: boolean
}

function IframeViewer({ url, title, onLoad, onError, loaded }: IframeViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleIframeLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onLoad?.()
  }, [onLoad])

  const handleIframeError = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onError?.()
  }, [onError])

  useEffect(() => {
    // Set timeout for embedding attempt
    timeoutRef.current = setTimeout(() => {
      onError?.()
    }, 5000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [url, onError])

  // Prevent page scroll when interacting with iframe
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // Only prevent if iframe is loaded and user is scrolling over the iframe area
      if (loaded) {
        e.stopPropagation()
      }
    }

    const handleMouseEnter = () => {
      // Disable page scroll when mouse enters iframe area
      if (loaded) {
        document.body.style.overflow = 'hidden'
      }
    }

    const handleMouseLeave = () => {
      // Re-enable page scroll when mouse leaves iframe area
      document.body.style.overflow = ''
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mouseenter', handleMouseEnter)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mouseenter', handleMouseEnter)
      container.removeEventListener('mouseleave', handleMouseLeave)
      // Ensure scroll is re-enabled on cleanup
      document.body.style.overflow = ''
    }
  }, [loaded])

  return (
    <div ref={containerRef} className="relative">
      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading virtual slide...</span>
          </div>
        </div>
      )}

      {/* Iframe viewer */}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-[600px] border-0"
        title={title}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allow="fullscreen"
        style={{
          pointerEvents: loaded ? 'auto' : 'none'
        }}
      />

      {/* Scroll hint overlay for loaded iframes */}
      {loaded && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Scroll to zoom • Mouse to pan
        </div>
      )}
    </div>
  )
}

// Fallback viewer component
interface FallbackViewerProps {
  slide: VirtualSlide
  onOpenExternal: () => void
}

function FallbackViewer({ slide, onOpenExternal }: FallbackViewerProps) {
  const getEmbeddingBlockedReason = (url: string): string => {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      if (hostname.includes('virtualpathology.leeds.ac.uk')) {
        return 'Leeds Virtual Pathology blocks iframe embedding for security. The slide will open in a new tab.'
      }

      if (hostname.includes('hematopathologyetutorial.com')) {
        return 'HematopathologyeTutorial should support embedding. If blocked, the slide will open in a new tab.'
      }

      if (hostname.includes('rosai.secondslide.com') || hostname.includes('rosaicollection.net')) {
        return 'Rosai Collection should support embedding. If blocked, the slide will open in a new tab.'
      }

      if (hostname.includes('lmpimg.med.utoronto.ca') || hostname.includes('dlm.lmp.utoronto.ca')) {
        return 'University of Toronto LMP blocks iframe embedding for security. The slide will open in a new tab.'
      }

      if (hostname.includes('recutclub.com')) {
        return 'Recut Club blocks iframe embedding for security. The slide will open in a new tab.'
      }

      const isRawWSI = /\.(svs|ndpi|scn|vms|vmu|mrxs|tiff?|czi|lsm|oib|oif)(\?|$)/i.test(url)
      if (isRawWSI) {
        return 'This raw WSI file format requires a specialized viewer application.'
      }

      return 'This virtual slide cannot be embedded but can be opened in a new tab.'
    } catch {
      return 'Virtual slide viewer not available for embedding.'
    }
  }

  return (
    <div className="relative bg-muted/20 min-h-[400px] flex flex-col items-center justify-center p-8">
      {slide.preview_image_url ? (
        <div className="text-center space-y-4">
          <div className="relative w-64 h-48 mx-auto">
            <Image
              src={slide.preview_image_url}
              alt={slide.diagnosis}
              fill
              unoptimized
              className="object-cover rounded-lg border"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {getEmbeddingBlockedReason(slide.slide_url)}
            </p>
            <Button onClick={onOpenExternal} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Virtual Slide
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-3">
            <h4 className="font-medium">Virtual Slide Cannot Be Embedded</h4>
            <p className="text-sm text-muted-foreground max-w-md">
              {getEmbeddingBlockedReason(slide.slide_url)}
            </p>
            <Button onClick={onOpenExternal} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Virtual Slide in New Tab
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Main WSI Viewer component
export function WSIViewer({ slide, showMetadata = true, className = '' }: WSIViewerProps) {
  const [viewerLoaded, setViewerLoaded] = useState(false)
  const [config, setConfig] = useState<WSIConfig | null>(null)

  // Step 1: Initialize configuration based on slide properties
  useEffect(() => {
    const initializeConfig = () => {
      const wsiConfig = getWSIConfig(slide.slide_url, slide.repository)
      setConfig(wsiConfig)
      setViewerLoaded(false)
    }

    initializeConfig()
  }, [slide.id, slide.slide_url, slide.repository])

  const handleViewerLoad = useCallback(() => {
    setViewerLoaded(true)
  }, [])

  const handleViewerError = useCallback(() => {
    // Error handling can be added here if needed
  }, [])

  const openInNewTab = () => {
    window.open(slide.slide_url, '_blank', 'noopener,noreferrer')
  }

  if (!config) {
    return <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* WSI Viewer */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {config.embeddingStrategy === 'openseadragon' ? (
            <InternalOpenSeadragonViewer
              url={slide.slide_url}
              filename={slide.slide_url.split('/').pop()}
              diagnosis={slide.diagnosis}
              onLoad={handleViewerLoad}
              onError={handleViewerError}
            />
          ) : config.embeddingStrategy === 'iframe' ? (
            <IframeViewer
              url={config.viewerUrl || slide.slide_url}
              title={`Virtual slide: ${slide.diagnosis}`}
              onLoad={handleViewerLoad}
              onError={handleViewerError}
              loaded={viewerLoaded}
            />
          ) : (
            <FallbackViewer
              slide={slide}
              onOpenExternal={openInNewTab}
            />
          )}
        </CardContent>
      </Card>

      {/* Slide Metadata */}
      {showMetadata && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-muted-foreground">Repository:</span>
                  <span className="ml-2">{slide.repository}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Category:</span>
                  <span className="ml-2">{slide.category}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Subcategory:</span>
                  <span className="ml-2">{slide.subcategory}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Stain:</span>
                  <span className="ml-2">{slide.stain_type}</span>
                </div>
              </div>
              <div className="space-y-2">
                {slide.patient_info && (
                  <div>
                    <span className="font-medium text-muted-foreground">Patient:</span>
                    <span className="ml-2">{slide.patient_info}</span>
                  </div>
                )}
                {slide.clinical_history && (
                  <div>
                    <span className="font-medium text-muted-foreground">Clinical History:</span>
                    <span className="ml-2">{slide.clinical_history}</span>
                  </div>
                )}
                {slide.case_url && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(slide.case_url, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Case
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Embedding component for debug interface
export function WSIEmbeddingViewer({ url, filename, diagnosis, className = '' }: WSIEmbeddingProps) {
  const [embedStatus, setEmbedStatus] = useState<'idle' | 'loading' | 'success' | 'blocked' | 'error'>('idle')
  const [config, setConfig] = useState<WSIConfig | null>(null)

  useEffect(() => {
    const wsiConfig = getWSIConfig(url)
    setConfig(wsiConfig)
    setEmbedStatus('idle')
  }, [url])

  const handleLoad = useCallback(() => {
    setEmbedStatus('success')
  }, [])

  const handleError = useCallback(() => {
    setEmbedStatus('error')
  }, [])

  const retryEmbed = () => {
    setEmbedStatus('loading')
    // Force reload by updating config
    const wsiConfig = getWSIConfig(url)
    setConfig({ ...wsiConfig })
  }

  if (!config) {
    return <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="aspect-video border rounded-lg overflow-hidden relative bg-gray-50">
        {config.embeddingStrategy === 'openseadragon' ? (
          <InternalOpenSeadragonViewer
            url={url}
            filename={filename}
            diagnosis={diagnosis}
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : config.embeddingStrategy === 'iframe' ? (
          <IframeViewer
            url={url}
            title={diagnosis || 'WSI Viewer'}
            onLoad={handleLoad}
            onError={handleError}
            loaded={embedStatus === 'success'}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <div className="space-y-2">
                <p className="font-medium">Cannot Embed WSI</p>
                <p className="text-sm text-muted-foreground">
                  {config.reason || 'This WSI format requires external viewing'}
                </p>
              </div>
              <Button onClick={() => window.open(url, '_blank')} size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Externally
              </Button>
            </div>
          </div>
        )}

        {/* Status overlay */}
        {embedStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
            <div className="text-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-muted-foreground">Loading WSI...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={embedStatus === 'success' ? 'default' : 'secondary'}>
            {embedStatus === 'success' ? 'Embedded' : 'External'}
          </Badge>
          {config.useOpenSeadragon && (
            <Badge variant="outline">OpenSeadragon</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {config.reason}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={retryEmbed} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button onClick={() => window.open(url, '_blank')} size="sm">
            <ExternalLink className="h-3 w-3 mr-1" />
            External
          </Button>
        </div>
      </div>
    </div>
  )
}


