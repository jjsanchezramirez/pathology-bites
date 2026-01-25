"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface ImageViewerModalProps {
  src: string;
  alt: string;
  description?: string;
  onClose: () => void;
}

export function ImageViewerModal({ src, alt, description, onClose }: ImageViewerModalProps) {
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    // Prevent body scrolling when modal is open
    document.body.style.overflow = "hidden";

    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Load image to get dimensions
    const img = document.createElement("img");
    img.src = src;
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };

    return () => {
      document.body.style.overflow = "auto";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, src]);

  // Calculate the display dimensions based on viewport constraints
  const getDisplayDimensions = () => {
    if (!imageDimensions) return { width: 800, height: 600 }; // Default while loading

    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.85; // Leave room for description below

    let { width, height } = imageDimensions;

    // Scale down if image is larger than viewport
    if (width > maxWidth || height > maxHeight) {
      const widthRatio = maxWidth / width;
      const heightRatio = maxHeight / height;
      const scale = Math.min(widthRatio, heightRatio);

      width = width * scale;
      height = height * scale;
    }

    return { width, height };
  };

  const displayDimensions = getDisplayDimensions();

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Container for image and description */}
      <div
        className="relative flex flex-col items-center gap-3 max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
        style={{ width: displayDimensions.width }}
      >
        {/* Image container */}
        <div
          className="relative bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          style={{
            width: displayDimensions.width,
            height: displayDimensions.height,
          }}
        >
          <Image src={src} alt={alt} fill className="object-contain" unoptimized />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
            aria-label="Close image viewer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Description below the image */}
        {description && (
          <div className="w-full text-white px-4 py-3">
            <p
              className="text-sm text-center"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.6)" }}
            >
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
