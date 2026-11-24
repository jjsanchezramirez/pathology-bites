"use client";

import { useState, useEffect, useRef } from "react";
import {
  HERO_GALLERY_IMAGES,
  type HeroGalleryImage,
} from "@/shared/components/common/hero-gallery-images";

type GalleryImage = HeroGalleryImage;

interface DisplayImage extends GalleryImage {
  position: {
    top: number;
    left: number;
    rotate: number;
    scale: number;
  };
  floatDelay: number;
  floatDuration: number;
  opacity: number;
}

const MIN_IMAGES = 2;
const MAX_IMAGES = 4;
const CYCLE_INTERVAL = 12000;
const FADE_DURATION = 2000;

// Each picture is pre-cropped to the 280x220 box it is drawn in, at 1x and 2x,
// as AVIF, WebP and a JPEG fallback, and served from /images/hero (same origin,
// one-year immutable cache from next.config.ts). Rebuild with
// `node scripts/build-hero-images.mjs`.
const HERO_IMAGES: GalleryImage[] = HERO_GALLERY_IMAGES;

interface OrganicImageGalleryProps {
  className?: string;
}

export function OrganicImageGallery({ className = "" }: OrganicImageGalleryProps) {
  const [mounted, setMounted] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const displayImagesRef = useRef<DisplayImage[]>([]);

  // Predefined grid positions for organized layout
  const GRID_POSITIONS: DisplayImage["position"][] = [
    // Top row
    { top: 5, left: 10, rotate: -8, scale: 1.0 },
    { top: 8, left: 55, rotate: 6, scale: 0.95 },
    // Middle row
    { top: 35, left: 5, rotate: 4, scale: 0.9 },
    { top: 38, left: 50, rotate: -5, scale: 1.05 },
    // Bottom row
    { top: 65, left: 15, rotate: -6, scale: 0.95 },
    { top: 68, left: 60, rotate: 7, scale: 0.9 },
  ];

  const generatePosition = (index: number): DisplayImage["position"] => {
    // Use predefined positions in order, with slight randomization
    const basePosition = GRID_POSITIONS[index % GRID_POSITIONS.length];
    return {
      top: basePosition.top + (Math.random() - 0.5) * 4,
      left: basePosition.left + (Math.random() - 0.5) * 4,
      rotate: basePosition.rotate + (Math.random() - 0.5) * 4,
      scale: basePosition.scale + (Math.random() - 0.5) * 0.1,
    };
  };

  // Fisher-Yates shuffle for truly random selection
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const createDisplayImages = (excludeIds: string[] = []): DisplayImage[] => {
    const count = MIN_IMAGES + Math.floor(Math.random() * (MAX_IMAGES - MIN_IMAGES + 1));
    // Filter out previously shown images
    const available = HERO_IMAGES.filter((img) => !excludeIds.includes(img.id));
    // If we don't have enough unique images, use all images
    const pool = available.length >= count ? available : HERO_IMAGES;
    // Use Fisher-Yates shuffle for truly random selection
    const shuffled = shuffleArray(pool);
    const selected = shuffled.slice(0, Math.min(count, pool.length));

    return selected.map((img, index) => ({
      ...img,
      position: generatePosition(index),
      floatDelay: Math.random() * 4,
      floatDuration: 6 + Math.random() * 4,
      opacity: 0,
    }));
  };

  // Mounted flag + viewport tracking. The gallery lives in a `hidden lg:block` column,
  // so below the lg breakpoint it's display:none — building it there just downloads an
  // eager hero AVIF nobody sees. Track the breakpoint so images only ever mount on lg+
  // (and (re)build if the viewport later crosses into it).
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Initialize + cycle the gallery — only while on a large screen. No API calls; uses
  // the hardcoded HERO_IMAGES.
  useEffect(() => {
    if (!isLargeScreen) {
      setDisplayImages([]);
      displayImagesRef.current = [];
      return;
    }
    if (HERO_IMAGES.length < MIN_IMAGES) return;

    const timers: NodeJS.Timeout[] = [];

    // Set initial images
    const initial = createDisplayImages();
    setDisplayImages(initial);
    displayImagesRef.current = initial;

    // Fade them in with staggered timing
    initial.forEach((img, index) => {
      const timer = setTimeout(
        () => {
          setDisplayImages((current) =>
            current.map((di) => (di.id === img.id ? { ...di, opacity: 1 } : di))
          );
        },
        100 + index * 300
      );
      timers.push(timer);
    });

    // Cycle images
    const interval = setInterval(() => {
      // Step 1: Fade out all current images simultaneously
      setDisplayImages((current) => current.map((img) => ({ ...img, opacity: 0 })));

      // Step 2: After fade out completes, replace with new images
      const replaceTimer = setTimeout(() => {
        const currentIds = displayImagesRef.current.map((img) => img.id);
        const newImages = createDisplayImages(currentIds);
        setDisplayImages(newImages);
        displayImagesRef.current = newImages;

        // Step 3: Fade in new images with staggered timing
        newImages.forEach((img, index) => {
          const timer = setTimeout(
            () => {
              setDisplayImages((current) =>
                current.map((di) => (di.id === img.id ? { ...di, opacity: 1 } : di))
              );
            },
            100 + index * 300
          );
          timers.push(timer);
        });
      }, FADE_DURATION);
      timers.push(replaceTimer);
    }, CYCLE_INTERVAL);

    return () => {
      clearInterval(interval);
      timers.forEach((timer) => clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLargeScreen]);

  // Don't render until mounted on client (avoids hydration mismatch from Math.random()),
  // and never render below lg — the column is display:none there, so skipping it keeps the
  // eager hero AVIF off mobile entirely.
  if (!mounted || !isLargeScreen) {
    return <div className={`relative w-full h-full ${className}`} />;
  }

  return (
    <>
      <style jsx global>{`
        @keyframes galleryFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
      <div className={`relative w-full h-full ${className}`}>
        {displayImages.map((img) => (
          <div
            key={img.id}
            className="absolute"
            style={{
              top: `${img.position.top}%`,
              left: `${img.position.left}%`,
              opacity: img.opacity,
              transition: `opacity ${FADE_DURATION}ms ease-in-out`,
              animation: `galleryFloat ${img.floatDuration}s ease-in-out ${img.floatDelay}s infinite`,
            }}
          >
            <div
              className="rounded-xl overflow-hidden shadow-2xl border-4 border-white/80"
              style={{
                transform: `rotate(${img.position.rotate}deg) scale(${img.position.scale})`,
                width: "280px",
                height: "220px",
              }}
            >
              <picture>
                <source srcSet={`${img.avif1x} 1x, ${img.avif2x} 2x`} type="image/avif" />
                <source srcSet={`${img.webp1x} 1x, ${img.webp2x} 2x`} type="image/webp" />
                <img
                  src={img.jpg2x}
                  alt={img.alt}
                  width={280}
                  height={220}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  loading="eager"
                  decoding="async"
                  fetchPriority={displayImages[0]?.id === img.id ? "high" : "low"}
                />
              </picture>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
