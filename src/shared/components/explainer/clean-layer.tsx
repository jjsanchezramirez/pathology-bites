"use client";

// DOM renderer for clean-look slides (see src/shared/lesson/clean.ts): the
// slide background, then every element in list order inside the camera.
// Positions are in percent of the 16:9 frame, text and strokes in cqw.
//
// Text is held to its box: if it doesn't fit (a long label, or a template's
// height estimate that came out short), its font shrinks until it does, down
// to MIN_TEXT_SCALE, rather than spilling over whatever sits below it.

import { memo, useLayoutEffect, useRef, useState } from "react";
import type { Transform } from "@/shared/types/explainer";
import { CLEAN, type CleanFrame, type CleanItem } from "@/shared/lesson/clean";
import type { ShapeKind, Rect } from "@/shared/lesson/types";
import { lessonSans } from "@/shared/fonts/lesson-fonts";
import { fitScale } from "@/shared/lesson/fit";

/** Height of the frame in percent-of-width units (16:9). */
const VH = 56.25;

const weight = (w: "normal" | "semibold" | "bold") =>
  w === "semibold" ? 600 : w === "bold" ? 700 : 400;

/** SVG path for a shape, in a 100 × 56.25 viewBox. */
function shapeD(shape: ShapeKind, r: Rect): string {
  const x = r.x;
  const y = (r.y / 100) * VH;
  const w = r.w;
  const h = shape === "circle" ? r.w : (r.h / 100) * VH;
  if (shape === "rectangle") return `M${x} ${y}h${w}v${h}h${-w}Z`;
  const rx = w / 2;
  const ry = h / 2;
  const cx = x + rx;
  const cy = y + ry;
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

const box = (r: Rect, rise: number): React.CSSProperties => ({
  position: "absolute",
  left: `${r.x}%`,
  top: `${r.y}%`,
  width: `${r.w}%`,
  height: `${r.h}%`,
  transform: rise ? `translateY(${rise.toFixed(3)}cqw)` : undefined,
});

type TextItem = Extract<CleanItem, { kind: "text" }>;

function textStyle(item: TextItem, scale: number): React.CSSProperties {
  return {
    boxSizing: "border-box",
    fontSize: `${item.fontSize * CLEAN.cqwPerRem * scale}cqw`,
    lineHeight: CLEAN.lineHeight,
    fontWeight: weight(item.fontWeight),
    textAlign: item.align,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    padding: item.background ? "0.6cqw" : undefined,
  };
}

/** A text item in its box, shrunk if needed so it never overflows. */
function FitText({ item }: { item: TextItem }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const boxEl = boxRef.current;
    const probe = measureRef.current;
    if (!boxEl || !probe) return;
    const base = item.fontSize * CLEAN.cqwPerRem;
    const run = () => {
      const h = boxEl.clientHeight;
      const w = boxEl.clientWidth;
      if (!h || !w) return; // not laid out (hidden, or no layout engine)
      const next = fitScale((k) => {
        probe.style.fontSize = `${base * k}cqw`;
        return probe.scrollHeight <= h + 1 && probe.scrollWidth <= w + 1;
      });
      setScale((cur) => (Math.abs(cur - next) > 0.005 ? next : cur));
    };
    run();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(run) : null;
    ro?.observe(boxEl);
    // Metrics change once the lesson font has loaded.
    document.fonts?.ready.then(run).catch(() => {});
    return () => ro?.disconnect();
  }, [item.text, item.rect.w, item.rect.h, item.fontSize, item.fontWeight, item.background]);

  const shown = item.chars != null ? item.text.slice(0, item.chars) : item.text;
  return (
    <div
      ref={boxRef}
      style={{
        ...box(item.rect, item.rise),
        opacity: item.opacity,
        color: item.color,
        background: item.background,
        borderRadius: item.background ? "0.5cqw" : undefined,
      }}
    >
      <div style={{ ...textStyle(item, scale), height: "100%" }}>{shown}</div>
      {/* Measures the full text (so letter-by-letter text doesn't change size as it types). */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          ...textStyle(item, 1),
          position: "absolute",
          inset: 0,
          visibility: "hidden",
          overflow: "hidden",
        }}
      >
        {item.text}
      </div>
    </div>
  );
}

export const CleanItemView = memo(function CleanItemView({ item }: { item: CleanItem }) {
  switch (item.kind) {
    case "shape": {
      const style: React.CSSProperties = {
        ...box(item.rect, item.rise),
        boxSizing: "border-box",
        opacity: item.opacity,
        background: item.fill ?? "transparent",
        border:
          item.stroke.width > 0
            ? `${item.stroke.width * CLEAN.strokeUnit}cqw ${item.stroke.style} ${item.stroke.color}`
            : undefined,
        borderRadius: item.shape === "rectangle" ? (item.radius ? `${item.radius}cqw` : 0) : "50%",
      };
      if (item.shape === "circle") {
        delete style.height;
        style.aspectRatio = "1 / 1";
      }
      return <div style={style} />;
    }
    case "spotlight":
      return (
        <svg
          viewBox={`0 0 100 ${VH}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            opacity: item.opacity,
          }}
        >
          <path
            d={`${item.within ? shapeD("rectangle", item.within) : `M-100 -100h300v${VH + 200}h-300Z`} ${shapeD(item.shape, item.rect)}`}
            fillRule="evenodd"
            fill={`rgba(${CLEAN.dimRgb}, ${item.dim})`}
          />
        </svg>
      );
    case "text":
      return <FitText item={item} />;
    case "image":
      if (!item.url) {
        // A template's empty picture slot.
        return (
          <div
            style={{
              ...box(item.rect, item.rise),
              opacity: item.opacity,
              background: "#DCE3E6",
              color: "#5B6B76",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: "1.4cqw",
              padding: "1cqw",
              boxSizing: "border-box",
            }}
          >
            Drop a library image here
          </div>
        );
      }
      return (
        <div style={{ ...box(item.rect, item.rise), opacity: item.opacity, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: item.svg ? "contain" : "cover",
              display: "block",
            }}
          />
        </div>
      );
    case "arrow": {
      const x1 = item.from.x;
      const y1 = (item.from.y / 100) * VH;
      const x2 = item.to.x;
      const y2 = (item.to.y / 100) * VH;
      const lw = item.strokeWidth * CLEAN.strokeUnit;
      const head = Math.max(lw * 3, item.headSize * CLEAN.strokeUnit);
      const a = Math.atan2(y2 - y1, x2 - x1);
      const p = (d: number, s: number) => `${x2 - Math.cos(a + d) * s},${y2 - Math.sin(a + d) * s}`;
      return (
        <svg
          viewBox={`0 0 100 ${VH}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            opacity: item.opacity,
          }}
        >
          <line
            x1={x1}
            y1={y1}
            x2={x2 - Math.cos(a) * head * 0.8}
            y2={y2 - Math.sin(a) * head * 0.8}
            stroke={item.color}
            strokeWidth={lw}
            strokeLinecap="round"
          />
          <polygon points={`${x2},${y2} ${p(-0.45, head)} ${p(0.45, head)}`} fill={item.color} />
        </svg>
      );
    }
  }
});

export function CleanLayer({
  frame,
  transform,
  opacity,
  zIndex,
}: {
  frame: CleanFrame;
  transform: Transform;
  opacity: number;
  zIndex?: number;
}) {
  if (opacity <= 0) return null;
  return (
    <div
      className={`${lessonSans.className} absolute inset-0 pointer-events-none overflow-hidden`}
      style={{ opacity, zIndex }}
    >
      <div className="absolute inset-0" style={{ background: frame.background }} />
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`,
          transformOrigin: "center center",
        }}
      >
        {frame.items.map((it) => (
          <CleanItemView key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}
