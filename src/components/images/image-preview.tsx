// src/components/images/image-preview.tsx
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Position {
  top: number;
  left: number;
}

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-16 md:w-20 md:h-20',
  md: 'w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28',
  lg: 'w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36'
};

export function ImagePreview({
  src,
  alt,
  className,
  size = 'sm'
}: ImagePreviewProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isFullSizeVisible, setIsFullSizeVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current || !previewRef.current) return null;

    const containerRect = containerRef.current.getBoundingClientRect();
    const previewRect = previewRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use responsive spacing based on viewport size
    const spacing = Math.max(16, viewportWidth * 0.02); // 2% of viewport width, minimum 16px

    let left = containerRect.right + spacing;
    let top = containerRect.top;

    // If preview would go off right edge, shift to the left
    if (left + previewRect.width > viewportWidth - spacing) {
      left = Math.max(spacing, containerRect.left - previewRect.width - spacing);
    }

    // Ensure preview stays within vertical bounds relative to viewport
    const maxTop = viewportHeight - previewRect.height - spacing;
    const minTop = spacing;
    top = Math.min(Math.max(top, minTop), maxTop);

    return { top, left };
  }, []);

  const updatePosition = useCallback(() => {
    const newPosition = calculatePosition();
    if (newPosition) {
      setPosition(newPosition);
    }
  }, [calculatePosition]);

  const handleShowPreview = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsPreviewVisible(true);
      requestAnimationFrame(() => {
        updatePosition();
      });
    }, 100);
  }, [updatePosition]);

  const handleHidePreview = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsPreviewVisible(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (!isPreviewVisible) return;

    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    const handleResize = () => {
      requestAnimationFrame(updatePosition);
    };

    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPreviewVisible, updatePosition]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Thumbnail */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-md overflow-hidden bg-muted cursor-zoom-in",
          "transition-all duration-200 ease-in-out",
          "hover:ring-2 hover:ring-primary/50",
          sizeClasses[size],
          className
        )}
        onMouseEnter={handleShowPreview}
        onMouseLeave={handleHidePreview}
        onClick={() => setIsFullSizeVisible(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsFullSizeVisible(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View ${alt}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className={cn(
            "object-cover",
            "transition-transform duration-200",
            "hover:scale-105"
          )}
          sizes={`(max-width: 768px) ${size === 'sm' ? '64px' : size === 'md' ? '96px' : '128px'}, ${size === 'sm' ? '64px' : size === 'md' ? '96px' : '128px'}`}
        />
      </div>

      {/* Preview Layer */}
      {isPreviewVisible && (
        <div
          ref={previewRef}
          className="fixed z-100 rounded-xl shadow-lg bg-white/5 backdrop-blur-xs"
          style={{
            top: position.top,
            left: position.left,
            opacity: 0,
            animation: 'preview-fade-in 200ms ease-out forwards'
          }}
        >
          <style jsx>{`
            @keyframes preview-fade-in {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          <Image
            src={src}
            alt={alt}
            width={0}
            height={0}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="max-w-[50vw] max-h-[50vh] md:max-w-[25vw] md:max-h-[25vh] w-auto h-auto object-contain rounded-xl"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '50vw',
              maxHeight: '50vh',
            }}
          />
        </div>
      )}

      {/* Full Size Dialog */}
      <Dialog open={isFullSizeVisible} onOpenChange={setIsFullSizeVisible}>
        <DialogContent
          className="p-0 border-0 bg-transparent overflow-hidden max-w-none w-fit h-fit flex items-center justify-center"
        >
          {/* Hidden Title for Accessibility */}
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>

          <Image
            src={src}
            alt={alt}
            width={0}
            height={0}
            sizes="90vw"
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-xl"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '90vw',
              maxHeight: '90vh',
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}