"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { ExternalLink, Loader2, AlertCircle, Info, Download } from "lucide-react";
import Image from "next/image";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { type VirtualSlide } from "./wsi-viewer-config";

interface OpenSeadragonViewerProps {
  url: string;
  filename?: string;
  diagnosis?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function InternalOpenSeadragonViewer({
  url,
  filename,
  diagnosis,
  onError,
}: OpenSeadragonViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeOpenSeadragon = async () => {
      try {
        setLoading(true);

        if (!viewerRef.current) return;

        // For now, show raw WSI file information since OpenSeadragon requires tile server
        // This is a placeholder for future OpenSeadragon integration
        setLoading(false);
        onError?.();
      } catch {
        setLoading(false);
        onError?.();
      }
    };

    const timer = setTimeout(initializeOpenSeadragon, 500);
    return () => clearTimeout(timer);
  }, [url, onError]);

  const getFileInfo = (url: string) => {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const extension = match ? match[1].toUpperCase() : "Unknown";

    const supportedFormats = {
      SVS: "Aperio ScanScope Virtual Slide",
      MRXS: "3DHISTECH MIRAX Virtual Slide",
      NDPI: "Hamamatsu NanoZoomer Digital Pathology Image",
      SCN: "Leica SCN Virtual Slide",
      VMS: "Hamamatsu Virtual Microscopy System",
      VMU: "Hamamatsu Virtual Microscopy System",
      TIFF: "Tagged Image File Format",
      TIF: "Tagged Image File Format",
      CZI: "Carl Zeiss Image",
      LSM: "Zeiss LSM Image",
      OIB: "Olympus Image Binary",
      OIF: "Olympus Image Format",
    };

    return {
      extension,
      description:
        supportedFormats[extension as keyof typeof supportedFormats] || "Virtual Slide Image",
      isSupported: extension in supportedFormats,
    };
  };

  const fileInfo = getFileInfo(url);
  const displayFilename = filename || url.split("/").pop() || "Virtual Slide";

  const openInNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadFile = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = displayFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-muted-foreground">Initializing OpenSeadragon...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4 p-6">
      {/* File Icon */}
      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
        <div className="text-blue-600 font-bold text-sm">{fileInfo.extension}</div>
      </div>

      {/* File Info */}
      <div className="space-y-2">
        <h3 className="font-medium text-lg">{diagnosis || "Virtual Slide Image"}</h3>
        <p className="text-sm text-muted-foreground">{fileInfo.description}</p>
        <p className="text-xs text-muted-foreground">{displayFilename}</p>
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
              <div>
                • For full viewing, use: QuPath, ImageJ with Bio-Formats, or Aperio ImageScope
              </div>
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
  );
}

// Iframe viewer component
interface IframeViewerProps {
  url: string;
  title: string;
  onLoad?: () => void;
  onError?: () => void;
  loaded: boolean;
  fillHeight?: boolean;
  crop?: { top: number; bottom: number };
}

export function IframeViewer({
  url,
  title,
  onLoad,
  onError,
  loaded,
  fillHeight,
  crop,
}: IframeViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onLoad?.();
  }, [onLoad]);

  const handleIframeError = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onError?.();
  }, [onError]);

  useEffect(() => {
    // Set timeout for embedding attempt
    timeoutRef.current = setTimeout(() => {
      onError?.();
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [url, onError]);

  // Prevent page scroll when interacting with iframe
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only prevent on mobile/small screens to avoid desktop scrollbar glitch
      if (loaded && isMobile) {
        e.stopPropagation();
      }
    };

    const _handleMouseEnter = () => {
      // Don't prevent scroll on desktop - only needed for mobile
      // Desktop users can use regular page scrolling
    };

    const _handleMouseLeave = () => {
      // Don't prevent scroll on desktop - only needed for mobile
      // Desktop users can use regular page scrolling
    };

    // Mobile touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (isMobile && loaded) {
        e.stopPropagation();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isMobile && loaded) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isMobile && loaded) {
        e.stopPropagation();
      }
    };

    // Add event listeners
    container.addEventListener("wheel", handleWheel, { passive: false });

    if (isMobile) {
      container.addEventListener("touchstart", handleTouchStart, { passive: false });
      container.addEventListener("touchmove", handleTouchMove, { passive: false });
      container.addEventListener("touchend", handleTouchEnd, { passive: false });
    }
    // Desktop doesn't need mouse enter/leave handlers anymore - removed scroll prevention

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      // Ensure scroll is re-enabled on cleanup (for mobile)
      document.body.style.overflow = "";
    };
  }, [loaded, isMobile]);

  return (
    <div ref={containerRef} className={`relative ${fillHeight ? "h-full" : ""}`}>
      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading virtual slide...</span>
          </div>
        </div>
      )}

      {/* Iframe viewer with mobile touch isolation */}
      <div
        className={`relative w-full overflow-hidden ${
          fillHeight ? "h-full" : isMobile ? "h-[350px]" : "h-[600px]"
        }`}
        onTouchStart={(e) => {
          // On mobile, prevent page scrolling when touching the WSI viewer
          if (isMobile && loaded) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchMove={(e) => {
          // On mobile, prevent page scrolling during touch gestures
          if (isMobile && loaded) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchEnd={(e) => {
          // On mobile, prevent page scrolling when touch ends
          if (isMobile && loaded) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{
          // On mobile, prevent scrolling and zooming of the container
          touchAction: isMobile ? "none" : "auto",
        }}
      >
        {/* Scaled iframe wrapper. Base: render page at 200% into the window then
            scale 0.5 (zoom-out, shows full page small). When `crop` is set and the
            window is fixed-height, uniformly scale the kept band up to fill the
            window and translate to hide the repo's top/bottom page chrome. */}
        {(() => {
          const cropApplies = !!crop && !fillHeight;
          const keep = cropApplies ? Math.max(0.05, 1 - crop!.top - crop!.bottom) : 1;
          const scale = 0.5 / keep;
          const windowH = isMobile ? 350 : 600;
          // With origin top-left + 200%-wide box: shift up to drop the top chrome band,
          // shift left to re-center the horizontally-zoomed page in the window.
          const translateY = cropApplies ? -(crop!.top * 2 * windowH * scale) : 0;
          const translateXPct = ((1 - 2 * scale) / 4) * 100;
          const transform = `translate(${translateXPct}%, ${translateY}px) scale(${scale})`;
          return (
            <div
              style={
                {
                  width: "200%",
                  height: "200%",
                  transformOrigin: "0 0",
                  WebkitTransform: transform,
                  MozTransform: transform,
                  OTransform: transform,
                  transform,
                } as React.CSSProperties
              }
            >
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title={title}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                allow="fullscreen"
                style={{
                  pointerEvents: loaded ? "auto" : "none",
                  // On mobile, let the iframe handle all touch events
                  touchAction: isMobile ? "manipulation" : "auto",
                }}
              />
            </div>
          );
        })()}
      </div>

      {/* Scroll hint overlay for loaded iframes */}
      {loaded && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Scroll to zoom • Mouse to pan
        </div>
      )}
    </div>
  );
}

// Fallback viewer component
interface FallbackViewerProps {
  slide: VirtualSlide;
  onOpenExternal: () => void;
}

export function FallbackViewer({ slide, onOpenExternal }: FallbackViewerProps) {
  const handleImageLoad = useImageCacheHandler(slide.preview_image_url);

  const getEmbeddingBlockedReason = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes("virtualpathology.leeds.ac.uk")) {
        return "Leeds Virtual Pathology blocks iframe embedding for security. The slide will open in a new tab.";
      }

      if (hostname.includes("hematopathologyetutorial.com")) {
        return "HematopathologyeTutorial should support embedding. If blocked, the slide will open in a new tab.";
      }

      if (hostname.includes("rosai.secondslide.com") || hostname.includes("rosaicollection.net")) {
        return "Rosai Collection should support embedding. If blocked, the slide will open in a new tab.";
      }

      if (hostname.includes("lmpimg.med.utoronto.ca") || hostname.includes("dlm.lmp.utoronto.ca")) {
        return "University of Toronto LMP blocks iframe embedding for security. The slide will open in a new tab.";
      }

      if (hostname.includes("recutclub.com")) {
        return "Recut Club blocks iframe embedding for security. The slide will open in a new tab.";
      }

      const isRawWSI = /\.(svs|ndpi|scn|vms|vmu|mrxs|tiff?|czi|lsm|oib|oif)(\?|$)/i.test(url);
      if (isRawWSI) {
        return "This raw WSI file format requires a specialized viewer application.";
      }

      return "This virtual slide cannot be embedded but can be opened in a new tab.";
    } catch {
      return "Virtual slide viewer not available for embedding.";
    }
  };

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
              onLoad={handleImageLoad}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
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
  );
}

// Main WSI Viewer component
