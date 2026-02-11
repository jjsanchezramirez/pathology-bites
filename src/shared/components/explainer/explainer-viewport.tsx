"use client";

import { useState } from "react";
import type {
  Segment,
  Transform,
  HighlightRegion,
  TextOverlay,
} from "@/shared/types/explainer";

interface ExplainerViewportProps {
  currentSegment: Segment | null;
  incomingSegment: Segment | null;
  transform: Transform;
  highlights: HighlightRegion[];
  textOverlays: (TextOverlay & { computedOpacity?: number })[];
  transitionOpacity: number;
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

function ImageLayer({
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return error ? (
    <div
      className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center"
      style={{ opacity }}
    >
      <span className="text-muted-foreground text-xs">Image failed to load</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt || ""}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className="absolute inset-0 w-full h-full object-cover will-change-transform"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`,
        opacity: loaded ? opacity : 0,
        transformOrigin: "center center",
      }}
      draggable={false}
    />
  );
}

function HighlightOverlay({ highlight }: { highlight: HighlightRegion }) {
  const isCircle = highlight.type === "circle";

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${highlight.position.x}%`,
        top: `${highlight.position.y}%`,
        width: `${highlight.size.width}%`,
        height: isCircle ? `${highlight.size.width}%` : `${highlight.size.height}%`,
        transform: "translate(-50%, -50%)",
        borderRadius: isCircle ? "50%" : "4px",
        border: `${highlight.borderWidth}px solid ${highlight.borderColor}`,
        backgroundColor: highlight.fillColor || "transparent",
        opacity: highlight.opacity,
        transition: "opacity 0.15s ease",
      }}
    />
  );
}

function TextOverlayElement({
  overlay,
}: {
  overlay: TextOverlay & { computedOpacity?: number };
}) {
  const computedOpacity = overlay.computedOpacity ?? 1;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${overlay.position.x}%`,
        top: `${overlay.position.y}%`,
        transform:
          overlay.animation === "slide-up"
            ? `translateY(${(1 - computedOpacity) * 0.5}rem)`
            : undefined,
        fontSize: `${overlay.fontSize}rem`,
        fontWeight:
          overlay.fontWeight === "semibold"
            ? 600
            : overlay.fontWeight === "bold"
              ? 700
              : 400,
        color: overlay.color,
        backgroundColor: overlay.backgroundColor,
        maxWidth: overlay.maxWidth ? `${overlay.maxWidth}%` : undefined,
        textAlign: overlay.textAlign || "left",
        opacity: computedOpacity,
        padding: overlay.backgroundColor ? "0.25rem 0.5rem" : undefined,
        borderRadius: overlay.backgroundColor ? "4px" : undefined,
        whiteSpace: "pre-wrap",
        transition: "opacity 0.15s ease, transform 0.15s ease",
        textShadow: !overlay.backgroundColor
          ? "0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)"
          : undefined,
      }}
    >
      {overlay.text}
    </div>
  );
}

export function ExplainerViewport({
  currentSegment,
  incomingSegment,
  transform,
  highlights,
  textOverlays,
  transitionOpacity,
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
      style={{ aspectRatio: getAspectRatioValue(aspectRatio) }}
      onClick={onClick}
    >
      {/* Incoming image layer (renders behind current during crossfade) */}
      {incomingSegment && (
        <ImageLayer
          src={incomingSegment.imageUrl}
          alt={incomingSegment.imageAlt}
          transform={
            incomingSegment.keyframes[0]?.transform ?? { x: 0, y: 0, scale: 1 }
          }
          opacity={1 - transitionOpacity}
        />
      )}

      {/* Current image layer */}
      <ImageLayer
        src={currentSegment.imageUrl}
        alt={currentSegment.imageAlt}
        transform={transform}
        opacity={transitionOpacity}
      />

      {/* Highlight overlays */}
      {highlights.map((h) => (
        <HighlightOverlay key={h.id} highlight={h} />
      ))}

      {/* Text overlays */}
      {textOverlays.map((o) => (
        <TextOverlayElement key={o.id} overlay={o} />
      ))}
    </div>
  );
}
