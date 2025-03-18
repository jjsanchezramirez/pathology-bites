import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

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
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32'
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
  const showTimeoutRef = useRef<number>();
  const hideTimeoutRef = useRef<number>();

  const calculatePosition = useCallback(() => {
    if (!containerRef.current || !previewRef.current) return null;
  
    const containerRect = containerRef.current.getBoundingClientRect();
    const previewRect = previewRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
  
    let left = containerRect.right + 16;
    let top = containerRect.top; // Using viewport-relative value
  
    // If preview would go off right edge, shift to the left
    if (left + previewRect.width > viewportWidth - 16) {
      left = Math.max(16, containerRect.left - previewRect.width - 16);
    }
  
    // Ensure preview stays within vertical bounds relative to viewport
    const maxTop = viewportHeight - previewRect.height - 16;
    const minTop = 16;
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
      window.clearTimeout(hideTimeoutRef.current);
    }
    
    showTimeoutRef.current = window.setTimeout(() => {
      setIsPreviewVisible(true);
      requestAnimationFrame(() => {
        updatePosition();
      });
    }, 100);
  }, [updatePosition]);

  const handleHidePreview = useCallback(() => {
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
    }
    
    hideTimeoutRef.current = window.setTimeout(() => {
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
        window.clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
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
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover",
            "transition-transform duration-200",
            "hover:scale-105"
          )}
        />
      </div>

      {/* Preview Layer */}
      {isPreviewVisible && (
        <div 
          ref={previewRef}
          className="fixed z-[100] rounded-xl shadow-lg bg-white/5 backdrop-blur-sm"
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
          <img 
            src={src} 
            alt={alt}
            className="max-w-[300px] max-h-[300px] w-auto h-auto object-contain rounded-xl"
          />
        </div>
      )}

      {/* Full Size Dialog */}
      <Dialog open={isFullSizeVisible} onOpenChange={setIsFullSizeVisible}>
        <DialogContent
          className="p-0 border-0 bg-transparent overflow-hidden [&>*]:p-0 max-w-none"
          style={{
            width: "fit-content",
            margin: 0,
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Hidden Title for Accessibility */}
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>

          <img
            src={src}
            alt={alt}
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
