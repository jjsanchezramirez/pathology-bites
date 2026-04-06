"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export interface TutorialStep {
  /** Matches `data-tutorial="<target>"` on the element to highlight */
  target: string;
  title: string;
  description: string;
  /** Preferred side for the tooltip. Defaults to "bottom" */
  side?: "top" | "bottom" | "left" | "right";
}

interface SpotlightTourProps {
  open: boolean;
  onComplete: () => void;
  steps: TutorialStep[];
  /** Label shown on the final step's primary button. Defaults to "Got it" */
  finishLabel?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_GAP = 12;
const ARROW_SIZE = 8;

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tutorial="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
  };
}

function scrollToTarget(target: string) {
  const el = document.querySelector(`[data-tutorial="${target}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const inView = r.top >= 0 && r.bottom <= window.innerHeight;
  if (!inView) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

type ResolvedSide = "top" | "bottom" | "left" | "right";

function resolveTooltipPosition(
  targetRect: Rect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredSide: ResolvedSide,
): { top: number; left: number; side: ResolvedSide } {
  const vw = window.innerWidth;
  const vh = window.innerHeight + window.scrollY;

  const centerX = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  const centerY = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;

  const positions: Record<ResolvedSide, { top: number; left: number }> = {
    bottom: {
      top: targetRect.top + targetRect.height + PADDING + TOOLTIP_GAP,
      left: Math.max(8, Math.min(centerX, vw - tooltipWidth - 8)),
    },
    top: {
      top: targetRect.top - PADDING - TOOLTIP_GAP - tooltipHeight,
      left: Math.max(8, Math.min(centerX, vw - tooltipWidth - 8)),
    },
    right: {
      top: Math.max(8, Math.min(centerY, vh - tooltipHeight - 8)),
      left: targetRect.left + targetRect.width + PADDING + TOOLTIP_GAP,
    },
    left: {
      top: Math.max(8, Math.min(centerY, vh - tooltipHeight - 8)),
      left: targetRect.left - PADDING - TOOLTIP_GAP - tooltipWidth,
    },
  };

  // Try preferred side first, then fallbacks
  const order: ResolvedSide[] = [preferredSide, "bottom", "top", "right", "left"];
  for (const side of order) {
    const pos = positions[side];
    const fitsX = pos.left >= 4 && pos.left + tooltipWidth <= vw - 4;
    const fitsY = pos.top >= 4 && pos.top + tooltipHeight <= vh - 4;
    if (fitsX && fitsY) return { ...pos, side };
  }

  // Fallback: below target, clamped
  return { ...positions.bottom, side: "bottom" };
}

function getArrowStyle(
  side: ResolvedSide,
  targetRect: Rect,
  tooltipLeft: number,
  tooltipTop: number,
  tooltipWidth: number,
  tooltipHeight: number,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
  };

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  switch (side) {
    case "bottom":
      return {
        ...base,
        top: -ARROW_SIZE,
        left: Math.max(12, Math.min(targetCenterX - tooltipLeft, tooltipWidth - 12)) - ARROW_SIZE,
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: "transparent transparent var(--color-card) transparent",
      };
    case "top":
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: Math.max(12, Math.min(targetCenterX - tooltipLeft, tooltipWidth - 12)) - ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`,
        borderColor: "var(--color-card) transparent transparent transparent",
      };
    case "right":
      return {
        ...base,
        left: -ARROW_SIZE,
        top: Math.max(12, Math.min(targetCenterY - tooltipTop, tooltipHeight - 12)) - ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: "transparent var(--color-card) transparent transparent",
      };
    case "left":
      return {
        ...base,
        right: -ARROW_SIZE,
        top: Math.max(12, Math.min(targetCenterY - tooltipTop, tooltipHeight - 12)) - ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: "transparent transparent transparent var(--color-card)",
      };
  }
}

export function SpotlightTour({
  open,
  onComplete,
  steps,
  finishLabel = "Got it",
}: SpotlightTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; side: ResolvedSide } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // Track whether we've completed at least one measurement cycle so we can fade in
  const [ready, setReady] = useState(false);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure target and position tooltip whenever step changes
  const measure = useCallback(() => {
    if (!step || !open) return;
    const rect = getTargetRect(step.target);
    setTargetRect(rect);

    if (rect && tooltipRef.current) {
      const tw = tooltipRef.current.offsetWidth;
      const th = tooltipRef.current.offsetHeight;
      const pos = resolveTooltipPosition(rect, tw, th, step.side || "bottom");
      setTooltipPos(pos);
      // Mark ready after first measurement so the initial fade-in triggers
      if (!ready) requestAnimationFrame(() => setReady(true));
    }
  }, [step, open, ready]);

  useEffect(() => {
    if (!open || !step) return;
    scrollToTarget(step.target);
    // Small delay to let scroll finish before measuring
    const timer = setTimeout(measure, 150);
    return () => clearTimeout(timer);
  }, [currentStep, open, step, measure]);

  // Re-measure on resize/scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, measure]);

  // Re-measure once tooltip is rendered (to get its dimensions)
  useEffect(() => {
    if (!open || !tooltipRef.current) return;
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [open, currentStep, measure]);

  const next = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, onComplete]);

  const back = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  if (!open || !step || !mounted) return null;

  const cutout = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
      }
    : null;

  const overlay = (
    <div
      className="fixed inset-0 z-[9998] transition-opacity duration-500 ease-out"
      style={{ pointerEvents: "none", opacity: ready ? 1 : 0 }}
    >
      {/* Dark overlay with cutout via clip-path */}
      <div
        className="absolute inset-0 transition-[clip-path] duration-300 ease-in-out"
        style={{
          pointerEvents: "auto",
          backgroundColor: "rgba(0,0,0,0.6)",
          clipPath: cutout
            ? `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                ${cutout.left}px ${cutout.top}px,
                ${cutout.left}px ${cutout.top + cutout.height}px,
                ${cutout.left + cutout.width}px ${cutout.top + cutout.height}px,
                ${cutout.left + cutout.width}px ${cutout.top}px,
                ${cutout.left}px ${cutout.top}px
              )`
            : undefined,
        }}
        onClick={onComplete}
      />

      {/* Highlight ring around target */}
      {cutout && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/60 transition-all duration-300"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[9999] w-72 rounded-xl border border-border bg-card p-4 shadow-xl transition-[top,left] duration-300 ease-in-out"
        style={{
          pointerEvents: "auto",
          top: tooltipPos?.top ?? 0,
          left: tooltipPos?.left ?? 0,
        }}
      >
        {/* Arrow */}
        {tooltipPos && targetRect && (
          <div
            style={getArrowStyle(
              tooltipPos.side,
              targetRect,
              tooltipPos.left,
              tooltipPos.top,
              tooltipRef.current?.offsetWidth || 288,
              tooltipRef.current?.offsetHeight || 200,
            )}
          />
        )}

        {/* Close */}
        <button
          onClick={onComplete}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground hover:bg-muted"
        >
          <X size={14} />
        </button>

        {/* Content */}
        <h3 className="text-sm font-semibold text-foreground pr-6">{step.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {step.description}
        </p>

        {/* Footer: dots + nav */}
        <div className="mt-3 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i === currentStep
                    ? "h-1.5 w-4 bg-primary"
                    : "size-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={back} className="h-7 px-2 text-xs">
                <ChevronLeft size={12} />
              </Button>
            )}
            {isFirst && (
              <Button variant="ghost" size="sm" onClick={onComplete} className="h-7 px-2 text-xs text-muted-foreground">
                Skip
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-7 px-3 text-xs gap-1">
              {isLast ? finishLabel : "Next"}
              {!isLast && <ChevronRight size={12} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
