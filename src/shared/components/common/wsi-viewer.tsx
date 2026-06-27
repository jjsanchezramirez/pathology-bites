"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ExternalLink, Loader2 } from "lucide-react";
import { type VirtualSlide, type WSIConfig, getWSIConfig } from "./wsi-viewer-config";
import { InternalOpenSeadragonViewer, IframeViewer, FallbackViewer } from "./wsi-viewer-panels";

interface WSIViewerProps {
  slide: VirtualSlide;
  showMetadata?: boolean;
  className?: string;
  // When true, viewer fills the height of its parent (parent must have a bounded height).
  fillHeight?: boolean;
}

// Configuration for different WSI types and repositories

export function WSIViewer({
  slide,
  showMetadata = true,
  className = "",
  fillHeight = false,
}: WSIViewerProps) {
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [config, setConfig] = useState<WSIConfig | null>(null);

  // Step 1: Initialize configuration based on slide properties
  useEffect(() => {
    const initializeConfig = () => {
      const wsiConfig = getWSIConfig(slide.slide_url, slide.repository);
      setConfig(wsiConfig);
      setViewerLoaded(false);
    };

    initializeConfig();
  }, [slide.id, slide.slide_url, slide.repository]);

  const handleViewerLoad = useCallback(() => {
    setViewerLoaded(true);
  }, []);

  const handleViewerError = useCallback(() => {
    // Error handling can be added here if needed
  }, []);

  const openInNewTab = () => {
    window.open(slide.slide_url, "_blank", "noopener,noreferrer");
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={
        fillHeight ? `flex flex-col h-full min-h-0 ${className}` : `space-y-4 ${className}`
      }
    >
      {/* WSI Viewer */}
      <Card
        className={`overflow-hidden ${fillHeight ? "flex-1 min-h-0 flex flex-col" : ""}`.trim()}
      >
        <CardContent className={`p-0 ${fillHeight ? "flex-1 min-h-0" : ""}`.trim()}>
          {config.embeddingStrategy === "openseadragon" ? (
            <InternalOpenSeadragonViewer
              url={slide.slide_url}
              filename={slide.slide_url.split("/").pop()}
              diagnosis={slide.diagnosis}
              onLoad={handleViewerLoad}
              onError={handleViewerError}
            />
          ) : config.embeddingStrategy === "iframe" ? (
            <IframeViewer
              url={config.viewerUrl || slide.slide_url}
              title={`Virtual slide: ${slide.diagnosis}`}
              onLoad={handleViewerLoad}
              onError={handleViewerError}
              loaded={viewerLoaded}
              fillHeight={fillHeight}
              crop={config.crop}
            />
          ) : (
            <FallbackViewer slide={slide} onOpenExternal={openInNewTab} />
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
                      onClick={() => window.open(slide.case_url, "_blank")}
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
  );
}
