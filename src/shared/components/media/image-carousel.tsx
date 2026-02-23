"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { useMobile } from "@/shared/hooks/use-mobile";
import { SilentErrorBoundary } from "@/shared/components/error-boundaries/silent-error-boundary";

interface ImageProps {
  url: string;
  alt: string;
  caption?: string;
}

interface ImageCarouselProps {
  images: ImageProps[];
  className?: string;
  // Optional key to force reset when context changes (e.g., new question)
  // Without this, carousel maintains state across different image sets
  resetKey?: string;
}

// Internal component that can throw errors
function ImageCarouselInternal({ images, className = "", resetKey }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const isMobile = useMobile();

  // Reset to first image only when resetKey changes (e.g., new question)
  // This prevents unwanted resets when the same images are re-rendered
  useEffect(() => {
    setCurrentIndex(0);
  }, [resetKey]);

  // Set loading state when image changes
  useEffect(() => {
    setImageLoading(true);
  }, [currentIndex, images]);

  // Keyboard navigation for fullscreen
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        return;
      }

      // Only handle arrow keys if multiple images exist
      if (images.length <= 1) return;

      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal, images.length]);

  // Ensure currentIndex is within bounds (defensive programming)
  const safeIndex = Math.min(currentIndex, images.length - 1);
  const currentImage = images[safeIndex];
  const handleImageLoad = useImageCacheHandler(currentImage?.url || "");

  // Early return if no images (after hooks to maintain hook call order)
  if (!images || images.length === 0) return null;

  const hasMultiple = images.length > 1;

  // Navigation helpers
  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  const openModal = () => !isMobile && setShowModal(true);

  return (
    <>
      {/* Carousel */}
      <div className={`relative ${className}`}>
        {/* Main image */}
        <div
          className={`relative rounded-lg overflow-hidden bg-muted group ${
            isMobile ? "cursor-default" : "cursor-pointer"
          }`}
          style={{ maxHeight: "70vh" }}
          onClick={openModal}
        >
          {/* Loading spinner overlay */}
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          )}

          {currentImage?.url ? (
            <Image
              src={currentImage.url}
              alt={currentImage.alt}
              width={1200}
              height={750}
              className="w-full h-auto max-h-[70vh] object-contain hover:opacity-90 transition-opacity"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized={true}
              onLoad={() => {
                handleImageLoad();
                setImageLoading(false);
              }}
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center bg-muted text-muted-foreground">
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

      {/* Beautiful modal with subtle blur background */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setShowModal(false)}
          >
            {/* Image container - shrink-wraps to image size */}
            <div className="relative inline-flex rounded-2xl shadow-2xl overflow-visible">
              {currentImage?.url ? (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  {/* Loading spinner overlay for modal */}
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-20">
                      <Loader2 className="w-12 h-12 text-white animate-spin" />
                    </div>
                  )}

                  <Image
                    src={currentImage.url}
                    alt={currentImage.alt}
                    width={1200}
                    height={800}
                    className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-2xl"
                    unoptimized={true}
                    onLoad={() => {
                      handleImageLoad();
                      setImageLoading(false);
                    }}
                  />

                  {/* Navigation controls positioned at image borders (only if multiple images) */}
                  {hasMultiple && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/20 hover:bg-gray-900/30 rounded-full flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-gray-900/20 shadow-lg z-10"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900/20 hover:bg-gray-900/30 rounded-full flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-gray-900/20 shadow-lg z-10"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>

                      {/* Image counter */}
                      <div className="absolute top-4 left-4 bg-gray-900/30 text-white text-sm font-semibold px-3 py-1.5 rounded-full border border-gray-900/30 shadow-lg z-10">
                        {currentIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/70 min-w-[300px] min-h-[200px] bg-white/5 rounded-2xl border border-white/10">
                  No image available
                </div>
              )}

              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-900/20 hover:bg-gray-900/30 flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-gray-900/20 shadow-lg z-10"
                aria-label="Close image"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// Exported component with error boundary
export function ImageCarousel({ images, className = "", resetKey }: ImageCarouselProps) {
  return (
    <SilentErrorBoundary
      maxRetries={2}
      retryDelay={1000}
      fallbackMessage="Image gallery temporarily unavailable"
      showErrorDetails={process.env.NODE_ENV === "development"}
      onError={(error, retryCount) => {
        console.warn(`ImageCarousel error (attempt ${retryCount + 1}):`, error.message);
      }}
    >
      <ImageCarouselInternal images={images} className={className} resetKey={resetKey} />
    </SilentErrorBoundary>
  );
}
