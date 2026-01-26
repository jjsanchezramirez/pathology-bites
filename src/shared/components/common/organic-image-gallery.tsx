"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface OrganicImageGalleryProps {
  className?: string;
}

interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

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

// Hardcoded microscopic pathology images from R2 CDN
// Selected for visual variety - all URLs verified to exist
const R2_BASE = "https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/library";
const HERO_IMAGES: GalleryImage[] = [
  {
    id: "1",
    url: `${R2_BASE}/20251022143356-cervical-cytology-with-adenocarcinoma-in-situ-ais-feathering-high-power.png`,
    alt: "Cervical cytology with adenocarcinoma in situ",
  },
  {
    id: "2",
    url: `${R2_BASE}/20251012190948-foveolar-type-adenoma-low-power.png`,
    alt: "Foveolar type adenoma low power",
  },
  {
    id: "3",
    url: `${R2_BASE}/20251022143357-cervical-cytology-with-herpes-changes-multinucleation-margination-and-molding-very-high-power.png`,
    alt: "Cervical cytology with herpes changes",
  },
  {
    id: "4",
    url: `${R2_BASE}/20251012190947-foveolar-type-adenoma-apical-mucin-cap-high-power.png`,
    alt: "Foveolar type adenoma high power",
  },
  {
    id: "5",
    url: `${R2_BASE}/20251015012457-paget-disease-with-secondary-osteosarcoma-low-power.png`,
    alt: "Paget disease with secondary osteosarcoma",
  },
  {
    id: "6",
    url: `${R2_BASE}/20251015012431-paget-disease-low-power.png`,
    alt: "Paget disease low power",
  },
  {
    id: "7",
    url: `${R2_BASE}/20251015012432-paget-disease-thickened-trabeculae-osteoblastic-rimming-and-osteoclasts-high-power.png`,
    alt: "Paget disease high power",
  },
  {
    id: "8",
    url: `${R2_BASE}/20251011011234-cogenital-mesoblastic-nephroma-fat-infiltration-medium-power.png`,
    alt: "Congenital mesoblastic nephroma",
  },
  {
    id: "9",
    url: `${R2_BASE}/20251011011235-cogenital-mesoblastic-nephroma-cellular-type-high-power.png`,
    alt: "Congenital mesoblastic nephroma cellular type",
  },
  {
    id: "10",
    url: `${R2_BASE}/20251015012456-paget-disease-with-secondary-osteosarcoma-fat-infiltration-low-power.png`,
    alt: "Paget disease with fat infiltration",
  },
];

export function OrganicImageGallery({ className = "" }: OrganicImageGalleryProps) {
  const [mounted, setMounted] = useState(false);
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

  // Initialize gallery - no API calls, uses hardcoded images
  useEffect(() => {
    setMounted(true);
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
  }, []);

  // Don't render images until mounted on client to avoid hydration mismatch from Math.random()
  if (!mounted) {
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
              <Image
                src={img.url}
                alt={img.alt}
                fill
                className="object-cover pointer-events-none"
                sizes="280px"
                unoptimized
                priority={displayImages[0]?.id === img.id}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
