"use client";

import { useState, useRef, useEffect, memo } from "react";
import type {
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  SvgOverlayElement,
} from "@/shared/types/explainer";

interface ExplainerViewportProps {
  currentSegment: Segment | null;
  incomingSegment: Segment | null;
  transform: Transform;
  highlights: HighlightRegion[];
  arrows: ArrowPointer[];
  textOverlays: TextOverlay[];
  svgOverlays?: SvgOverlayElement[];
  transitionOpacity: number;
  incomingOpacity?: number;
  aspectRatio: string;
  onClick?: () => void;
}

function getAspectRatioValue(ratio: string): string {
  switch (ratio) {
    case "16:9":
      return "16/9";
    case "16:10":
      return "16/10";
    case "4:3":
      return "4/3";
    default:
      return "16/9";
  }
}

const ImageLayer = memo(function ImageLayer({
  src,
  alt,
  transform,
  opacity,
}: {
  src: string;
  alt?: string;
  transform: Transform;
  opacity: number;
}) {
  // Initialise loaded=true immediately if the browser already has this image cached,
  // so we never flicker to opacity-0 for a cached frame.
  const [loaded, setLoaded] = useState(() => {
    if (typeof window === "undefined") return false;
    const img = new window.Image();
    img.src = src;
    return img.complete && img.naturalHeight !== 0;
  });
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const prevSrcRef = useRef(src);

  // When src changes, re-evaluate whether the new image is already cached
  useEffect(() => {
    // Only reset state if the URL actually changed
    if (prevSrcRef.current !== src) {
      setError(false);
      const img = imgRef.current;
      const alreadyCached = img ? img.complete && img.naturalHeight !== 0 : false;
      setLoaded(alreadyCached);
      prevSrcRef.current = src;
    }
  }, [src]);

  return error ? (
    <div
      className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center"
      style={{ opacity }}
    >
      <div className="text-center space-y-2 p-4">
        <span className="text-destructive text-sm font-medium">Image failed to load</span>
        <div className="text-xs text-muted-foreground max-w-md break-all">{src}</div>
      </div>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt || ""}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className="absolute inset-0 w-full h-full object-contain"
      style={{
        // Use transform for both movement AND opacity (GPU accelerated)
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`,
        opacity: loaded ? opacity : 0,
        transformOrigin: "center center",
        // Force GPU acceleration with hardware acceleration hints
        willChange: "transform, opacity",
        // Use translate3d to force GPU layer (even though we're using %)
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        // Remove CSS transitions - we're updating via React state at 60fps
        transition: "none",
      }}
      draggable={false}
    />
  );
});

function HighlightOverlay({ highlight }: { highlight: HighlightRegion }) {
  const isCircle = highlight.type === "circle";
  const isOval = highlight.type === "oval";

  // For circles, use aspect ratio to ensure perfect circle
  const getSize = () => {
    if (isCircle) {
      return {
        width: `${highlight.size.width}%`,
        aspectRatio: "1/1",
      };
    }
    return {
      width: `${highlight.size.width}%`,
      height: `${highlight.size.height}%`,
    };
  };

  const size = getSize();

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${highlight.position.x}%`,
        top: `${highlight.position.y}%`,
        ...size,
        transform: "translate(-50%, -50%)",
        borderRadius: isCircle || isOval ? "50%" : "4px",
        border: `${highlight.borderWidth}px ${highlight.borderStyle || "solid"} ${highlight.borderColor}`,
        backgroundColor: highlight.fillColor || "transparent",
        opacity: highlight.opacity,
        transition: "none",
        zIndex: 10,
      }}
    />
  );
}

function ArrowOverlay({ arrow }: { arrow: ArrowPointer }) {
  const markerId = `arrowhead-${arrow.id}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 15, opacity: arrow.opacity }}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={arrow.color} />
        </marker>
      </defs>
      <line
        x1={arrow.startPosition.x}
        y1={arrow.startPosition.y}
        x2={arrow.endPosition.x}
        y2={arrow.endPosition.y}
        stroke={arrow.color}
        strokeWidth={arrow.strokeWidth}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        style={{
          filter: "drop-shadow(0 0.5px 2px rgba(0,0,0,0.8))",
        }}
      />
    </svg>
  );
}

function SpotlightOverlay({
  highlights,
  aspectRatio,
  transform,
}: {
  highlights: HighlightRegion[];
  aspectRatio: string;
  transform: Transform;
}) {
  const spotlightHighlights = highlights.filter((h) => h.spotlight && h.opacity > 0.01);

  if (spotlightHighlights.length === 0) return null;

  // Transform spotlight coordinates from image-space to viewport-space so the
  // cutout tracks the image as it pans/zooms.  The image CSS transform is
  // `translate(tx%, ty%) scale(s)` with transformOrigin center center.
  // CSS applies left-to-right in visual space: translate first, then scale
  // around the element center.  A point at (imgX%, imgY%) in image-space maps
  // to viewport-space as:
  //   vpX = (imgX - 50) * scale + 50 + tx
  //   vpY = (imgY - 50) * scale + 50 + ty
  // Sizes simply scale:  vpW = imgW * scale
  const transformedSpotlights = spotlightHighlights.map((h) => ({
    ...h,
    position: {
      x: (h.position.x - 50) * transform.scale + 50 + transform.x,
      y: (h.position.y - 50) * transform.scale + 50 + transform.y,
    },
    size: {
      width: h.size.width * transform.scale,
      height: h.size.height * transform.scale,
    },
  }));

  // Calculate the maximum opacity from all spotlights
  const maxOpacity = Math.max(...spotlightHighlights.map((h) => h.opacity));

  // Parse aspect ratio to get viewBox dimensions that match the viewport
  const [widthRatio, heightRatio] = aspectRatio.split(":").map(Number);
  const viewBoxWidth = widthRatio;
  const viewBoxHeight = heightRatio;

  // Scale factors to convert from percentage (0-100) to viewBox coordinates
  const scaleX = viewBoxWidth / 100;
  const scaleY = viewBoxHeight / 100;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="none"
      style={{ zIndex: 5 }}
    >
      <defs>
        {/* Blur filters for soft edges - create multiple with different strengths */}
        {transformedSpotlights.map((highlight, idx) => {
          // Calculate blur based on size - smaller shapes get less blur
          const avgSize = (highlight.size.width + highlight.size.height) / 2;
          // Scale blur to match the viewBox coordinate system
          const avgViewBoxScale = (scaleX + scaleY) / 2;
          const blurAmount = Math.max(0.05, Math.min(0.3, avgSize * 0.04 * avgViewBoxScale));
          return (
            <filter key={`blur-${highlight.id}`} id={`spotlight-blur-${idx}`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={blurAmount} />
            </filter>
          );
        })}

        <mask id="spotlight-mask">
          <rect width={viewBoxWidth} height={viewBoxHeight} fill="white" />
          {transformedSpotlights.map((highlight, idx) => {
            const isCircle = highlight.type === "circle";
            const isOval = highlight.type === "oval";

            // Convert positions and sizes from percentage to viewBox coordinates
            const cx = highlight.position.x * scaleX;
            const cy = highlight.position.y * scaleY;
            const width = highlight.size.width * scaleX;
            const height = highlight.size.height * scaleY;

            if (isCircle) {
              // For circles, use average scale to get a true circle
              const avgScale = (scaleX + scaleY) / 2;
              const r = (highlight.size.width * avgScale) / 2;
              return (
                <circle
                  key={highlight.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="black"
                  filter={`url(#spotlight-blur-${idx})`}
                />
              );
            } else if (isOval) {
              return (
                <ellipse
                  key={highlight.id}
                  cx={cx}
                  cy={cy}
                  rx={width / 2}
                  ry={height / 2}
                  fill="black"
                  filter={`url(#spotlight-blur-${idx})`}
                />
              );
            } else {
              return (
                <rect
                  key={highlight.id}
                  x={cx - width / 2}
                  y={cy - height / 2}
                  width={width}
                  height={height}
                  rx={0.1}
                  fill="black"
                  filter={`url(#spotlight-blur-${idx})`}
                />
              );
            }
          })}
        </mask>
      </defs>
      <rect
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill="black"
        mask="url(#spotlight-mask)"
        opacity={0.5 * maxOpacity}
      />
    </svg>
  );
}

function TextOverlayElement({ overlay }: { overlay: TextOverlay }) {
  const computedOpacity = overlay.computedOpacity ?? 1;

  // Build transform with centering and optional slide-up animation
  const buildTransform = () => {
    const centerTransform = "translate(-50%, -50%)";
    if (overlay.animation === "slide-up") {
      const slideOffset = (1 - computedOpacity) * 0.5;
      return `${centerTransform} translateY(${slideOffset}cqw)`;
    }
    return centerTransform;
  };

  // Convert rem-based fontSize to container query units (cqw)
  // 1.6rem at 1920px viewport ≈ 1.33cqw (1.6 * 16 / 1920 * 100)
  // We use a scaling factor to maintain readability across sizes
  const fontSizeCqw = overlay.fontSize * 1.67; // Tuned for good appearance

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${overlay.position.x}%`,
        top: `${overlay.position.y}%`,
        transform: buildTransform(),
        fontSize: `${fontSizeCqw}cqw`,
        fontWeight:
          overlay.fontWeight === "semibold" ? 600 : overlay.fontWeight === "bold" ? 700 : 400,
        color: overlay.color,
        backgroundColor: overlay.backgroundColor,
        maxWidth: overlay.maxWidth ? `${overlay.maxWidth}%` : undefined,
        textAlign: overlay.textAlign || "left",
        opacity: computedOpacity,
        padding: overlay.backgroundColor ? "0.4cqw 0.8cqw" : undefined,
        borderRadius: overlay.backgroundColor ? "0.4cqw" : undefined,
        whiteSpace: "pre-wrap",
        transition: "none",
        textShadow: !overlay.backgroundColor
          ? "0 0.1cqw 0.3cqw rgba(0,0,0,0.8), 0 0 0.8cqw rgba(0,0,0,0.5)"
          : undefined,
        zIndex: 20,
      }}
    >
      {overlay.text}
    </div>
  );
}

function SvgOverlayItem({ overlay }: { overlay: SvgOverlayElement }) {
  const computedOpacity = overlay.computedOpacity ?? overlay.opacity;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${overlay.position.x}%`,
        top: `${overlay.position.y}%`,
        width: `${overlay.size.width}%`,
        height: `${overlay.size.height}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
        opacity: computedOpacity,
        transition: "none",
        zIndex: 18,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={overlay.svgUrl}
        alt=""
        className="w-full h-full"
        draggable={false}
      />
    </div>
  );
}

export function ExplainerViewport({
  currentSegment,
  incomingSegment,
  transform,
  highlights,
  arrows,
  textOverlays,
  svgOverlays = [],
  transitionOpacity,
  incomingOpacity = 0,
  aspectRatio,
  onClick,
}: ExplainerViewportProps) {
  if (!currentSegment) {
    return (
      <div
        className="relative w-full bg-black flex items-center justify-center"
        style={{ aspectRatio: getAspectRatioValue(aspectRatio) }}
      >
        <div className="text-muted-foreground text-sm">No content</div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full bg-black overflow-hidden cursor-pointer select-none"
      style={{
        aspectRatio: getAspectRatioValue(aspectRatio),
        // Optimize container for GPU rendering
        transform: "translateZ(0)",
        willChange: "transform",
      }}
      onClick={onClick}
    >
      {/* Current image layer (bottom layer) or blank segment background */}
      {currentSegment.imageUrl ? (
        <ImageLayer
          src={currentSegment.imageUrl}
          alt={currentSegment.imageAlt}
          transform={transform}
          opacity={transitionOpacity}
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundColor: currentSegment.backgroundColor || "#000000",
            opacity: transitionOpacity,
          }}
        />
      )}

      {/* Incoming image layer (fades in on top of current) */}
      {incomingSegment && incomingOpacity > 0 && (
        incomingSegment.imageUrl ? (
          <ImageLayer
            src={incomingSegment.imageUrl}
            alt={incomingSegment.imageAlt}
            transform={incomingSegment.keyframes[0]?.transform ?? { x: 0, y: 0, scale: 1 }}
            opacity={incomingOpacity}
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundColor: incomingSegment.backgroundColor || "#000000",
              opacity: incomingOpacity,
            }}
          />
        )
      )}

      {/* Spotlight overlay (dims everything except highlighted regions) */}
      <SpotlightOverlay highlights={highlights} aspectRatio={aspectRatio} transform={transform} />

      {/* Image-tracking layer: annotations that follow the image as it pans/zooms */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
        style={{
          transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`,
          transformOrigin: "center center",
          transition: "none",
          zIndex: 3,
        }}
      >
        {/* Highlight overlays (skip rendering borders for spotlights) */}
        {highlights
          .filter((h) => !h.spotlight)
          .map((h) => (
            <HighlightOverlay key={h.id} highlight={h} />
          ))}

        {/* Arrow overlays */}
        {arrows.map((a) => (
          <ArrowOverlay key={a.id} arrow={a} />
        ))}
      </div>

      {/* SVG overlays */}
      {svgOverlays.map((s) => (
        <SvgOverlayItem key={s.id} overlay={s} />
      ))}

      {/* Text overlays */}
      {textOverlays.map((o) => (
        <TextOverlayElement key={o.id} overlay={o} />
      ))}
    </div>
  );
}
