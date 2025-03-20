// src/components/images/image-carousel.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Maximize } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { cn } from "@/lib/utils"

interface ImageItem {
  url: string;
  caption: string;
  alt: string;
}

interface ImageCarouselProps {
  images: ImageItem[];
  className?: string;
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullSizeVisible, setIsFullSizeVisible] = useState(false);
  const [fullSizeIndex, setFullSizeIndex] = useState(0);
  const [isFullSizeLoaded, setIsFullSizeLoaded] = useState(false);
  // Removed fading state as we want immediate transitions
  const carouselImageRef = useRef<HTMLDivElement>(null);
  
  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;

  // Preload full-size images
  useEffect(() => {
    const preloadImages = () => {
      images.forEach(image => {
        const img = new window.Image();
        img.src = image.url;
      });
    };
    preloadImages();
  }, [images]);

  // Simplified transition logic for immediate image changes
  const applyTransition = useCallback((callback: () => void) => {
    // Execute the callback immediately without artificial delays
    callback();
  }, []);

  const goToPrevious = useCallback(() => {
    applyTransition(() => {
      setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
    });
  }, [applyTransition, images.length]);

  const goToNext = useCallback(() => {
    applyTransition(() => {
      setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
    });
  }, [applyTransition, images.length]);

  const openFullSize = useCallback(() => {
    setFullSizeIndex(currentIndex);
    setIsFullSizeLoaded(false);
    setIsFullSizeVisible(true);
  }, [currentIndex]);

  const handleFullSizeNavigation = useCallback((direction: 'next' | 'previous', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Set fullsize index immediately without any transitions
    setFullSizeIndex((prevIndex) => {
      if (direction === 'next') {
        return prevIndex === images.length - 1 ? 0 : prevIndex + 1;
      } else {
        return prevIndex === 0 ? images.length - 1 : prevIndex - 1;
      }
    });
  }, [images.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullSizeVisible) return;
      
      if (e.key === 'ArrowLeft') {
        handleFullSizeNavigation('previous');
      } else if (e.key === 'ArrowRight') {
        handleFullSizeNavigation('next');
      } else if (e.key === 'Escape') {
        setIsFullSizeVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullSizeVisible, handleFullSizeNavigation]);

  const handleFullSizeImageLoad = () => {
    setIsFullSizeLoaded(true);
  };

  // No need for separate button class variables as we're applying styles directly

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative rounded-lg border overflow-hidden">
        {/* Main Image */}
        <div 
          ref={carouselImageRef}
          className="relative flex items-center justify-center w-full h-56 cursor-zoom-in"
          onClick={openFullSize}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFullSize();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`View ${currentImage.alt}`}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.alt}
            width={500}
            height={300}
            className="max-h-56 w-auto object-contain"
            priority={true}
          />
          <div className="absolute bottom-2 right-2 bg-black/70 p-1 rounded-md text-white">
            <Maximize size={18} color="white" />
          </div>
        </div>

        {/* Navigation Buttons - Only show if multiple images */}
        {hasMultipleImages && (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/70 text-white hover:bg-black/90"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              <ChevronLeft size={18} color="white" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/70 text-white hover:bg-black/90"
              onClick={goToNext}
              aria-label="Next image"
            >
              <ChevronRight size={18} color="white" />
            </Button>
          </>
        )}
      </div>

      {/* Image Counter - Only show if multiple images */}
      {hasMultipleImages && (
        <div className="flex justify-center gap-1" role="tablist" aria-label="Image navigation">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
              )}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to image ${index + 1}`}
              role="tab"
              aria-selected={index === currentIndex}
            />
          ))}
        </div>
      )}

      {/* Full Size Dialog */}
      <Dialog open={isFullSizeVisible} onOpenChange={setIsFullSizeVisible}>
        <DialogContent
          className="p-0 border-0 bg-black/95 overflow-hidden [&>*]:p-0 max-w-none"
          style={{
            width: "fit-content",
            margin: 0,
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            opacity: isFullSizeLoaded ? 1 : 0
          }}
        >
          {/* Hidden Title for Accessibility */}
          <VisuallyHidden>
            <DialogTitle>{images[fullSizeIndex].alt}</DialogTitle>
          </VisuallyHidden>

          <div className="relative">
            <div>
              <Image 
                src={images[fullSizeIndex].url} 
                alt={images[fullSizeIndex].alt}
                width={1200}
                height={800}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                priority
                onLoad={handleFullSizeImageLoad}
              />
            </div>

            {/* Full Size Navigation */}
            {hasMultipleImages && isFullSizeLoaded && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 text-white hover:bg-black/90"
                  onClick={(e) => handleFullSizeNavigation('previous', e)}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} color="white" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 text-white hover:bg-black/90"
                  onClick={(e) => handleFullSizeNavigation('next', e)}
                  aria-label="Next image"
                >
                  <ChevronRight size={24} color="white" />
                </Button>
              </>
            )}

            {/* Counter indicator */}
            {hasMultipleImages && isFullSizeLoaded && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full text-white text-sm font-medium">
                {fullSizeIndex + 1} / {images.length}
              </div>
            )}

            {/* Using Dialog's built-in close button - no custom close button needed */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}