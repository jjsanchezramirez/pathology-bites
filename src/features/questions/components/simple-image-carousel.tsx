"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMobile } from "@/shared/hooks/use-mobile";
import { SilentErrorBoundary } from "@/shared/components/error-boundaries/silent-error-boundary";

interface ImageProps {
  url: string;
  alt: string;
  caption?: string;
}

interface SimpleImageCarouselProps {
  images: ImageProps[];
  className?: string;
}

// Internal component that can throw errors
function SimpleImageCarouselInternal({ images, className = "" }: SimpleImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isMobile = useMobile();

  // Get the current image for hook usage
  const currentImage = images && images.length > 0 ? images[currentIndex] : null;
  const handleImageLoad = useImageCacheHandler(currentImage?.url || "");

  // Reset to first image when images array changes (e.g., new question)
  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  if (!images || images.length === 0) return null;

  const hasMultiple = images.length > 1;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main image */}
      <div
        className="relative rounded-lg overflow-hidden bg-muted group cursor-default"
        style={{ aspectRatio: "16/10" }}
      >
        {currentImage?.url ? (
          <Image
            src={currentImage.url}
            alt={currentImage.alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={true}
            onLoad={handleImageLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image available
          </div>
        )}

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <div
              className={`absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm rounded-full transition-all duration-200 ${
                isMobile
                  ? "opacity-70" // Always visible on mobile
                  : "opacity-0 group-hover:opacity-100" // Original behavior on desktop
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className={`p-2 hover:bg-black/10 rounded-full transition-all duration-200 ${
                  isMobile ? "p-3" : "p-2"
                }`}
                aria-label="Previous image"
              >
                <ChevronLeft size={16} className="text-white" />
              </button>
            </div>
            <div
              className={`absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm rounded-full transition-all duration-200 ${
                isMobile
                  ? "opacity-70" // Always visible on mobile
                  : "opacity-0 group-hover:opacity-100" // Original behavior on desktop
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className={`p-2 hover:bg-black/10 rounded-full transition-all duration-200 ${
                  isMobile ? "p-3" : "p-2"
                }`}
                aria-label="Next image"
              >
                <ChevronRight size={16} className="text-white" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dots positioned on top of image */}
      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? "bg-white scale-125"
                  : "bg-white/60 hover:bg-white/80 hover:scale-110"
              }`}
              aria-label={`View image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Exported component with error boundary
export function SimpleImageCarousel({ images, className = "" }: SimpleImageCarouselProps) {
  return (
    <SilentErrorBoundary
      maxRetries={2}
      retryDelay={1000}
      fallbackMessage="Image gallery temporarily unavailable"
      showErrorDetails={process.env.NODE_ENV === "development"}
      onError={(error, retryCount) => {
        console.warn(`SimpleImageCarousel error (attempt ${retryCount + 1}):`, error.message);
      }}
    >
      <SimpleImageCarouselInternal images={images} className={className} />
    </SilentErrorBoundary>
  );
}
