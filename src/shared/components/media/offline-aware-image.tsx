// src/shared/components/media/offline-aware-image.tsx
"use client";

import Image, { ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/shared/utils";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";

// Module-level cache of "we've successfully loaded this URL at least once during
// this session." If we go offline AFTER the image was rendered, we keep
// rendering it — the browser's HTTP cache will serve it. If we go offline
// BEFORE it ever loaded, we render a stable placeholder instead of an empty
// <img> that blinks every re-render.
const loadedUrls = new Set<string>();

interface OfflineAwareImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  onLoad?: () => void;
  onError?: () => void;
  /** Optional override for the placeholder className (e.g. to match aspect ratio). */
  placeholderClassName?: string;
}

/**
 * Drop-in replacement for `next/image` that degrades gracefully when offline.
 *
 * Behavior:
 * - Online + first render: same as `<Image>`.
 * - Offline + image was loaded earlier this session: render `<Image>` (browser
 *   HTTP cache will serve it).
 * - Offline + image was never loaded: render an offline placeholder. No
 *   network request is fired, so there's no blink loop when the parent
 *   re-renders.
 * - Errored (e.g. 404 or network failure mid-load): render the placeholder.
 * - Browser fires `online` event after an error: reset and let `<Image>` retry
 *   once.
 */
export function OfflineAwareImage({
  src,
  alt,
  onLoad,
  onError,
  className,
  placeholderClassName,
  ...rest
}: OfflineAwareImageProps) {
  const isOnline = useOnlineStatus();
  const srcKey = typeof src === "string" ? src : "";
  const [hasLoaded, setHasLoaded] = useState(() => loadedUrls.has(srcKey));
  const [hasErrored, setHasErrored] = useState(false);

  // When we come back online after an error, allow one retry.
  useEffect(() => {
    if (isOnline && hasErrored) {
      setHasErrored(false);
    }
  }, [isOnline, hasErrored]);

  const showPlaceholder = (!isOnline && !hasLoaded) || hasErrored;

  if (showPlaceholder) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground",
          placeholderClassName ?? className
        )}
      >
        <ImageOff className="h-8 w-8 opacity-50" />
        <span className="text-xs">Image unavailable offline</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      {...rest}
      onLoad={() => {
        if (srcKey) loadedUrls.add(srcKey);
        setHasLoaded(true);
        onLoad?.();
      }}
      onError={() => {
        setHasErrored(true);
        onError?.();
      }}
    />
  );
}

/**
 * Programmatically warm the browser's HTTP cache for a list of image URLs.
 * Use this on quiz start so that images in the on-deck questions are already
 * cached if the user goes offline mid-quiz.
 */
export function preloadImages(urls: string[]): void {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url) continue;
    const img = new window.Image();
    img.src = url;
  }
}
