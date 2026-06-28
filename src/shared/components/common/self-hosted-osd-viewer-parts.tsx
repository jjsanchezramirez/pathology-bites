"use client";

import { useCallback, useRef, useState } from "react";

// Presentational sub-components extracted verbatim from self-hosted-osd-viewer.tsx
// (control-bar bits + the magnification slider and rotation dial).

export function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-black/10" />;
}

// Popover anchored directly under its trigger button (parent must be `relative`).
export function Popover({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-pb-popover
      className={`absolute top-full z-20 mt-2 rounded-lg bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur ${
        className.includes("right-0") ? "" : "left-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Magnification slider styled like the rotation dial (thin primary track + white-ringed
// primary knob). Drags smoothly via a local fraction (no OSD round-trip), snaps on release.
export function MagSlider({
  frac,
  onLive,
  onCommit,
  snapStep,
}: {
  frac: number;
  onLive: (f: number) => void;
  onCommit: (f: number) => void;
  // Optional HARD step at every `snapStep` fraction (e.g. 0.1 = discrete ticks every 10%).
  snapStep?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const f = Math.min(1, Math.max(0, drag ?? frac));

  const fracFromX = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    // Hard ticks: always round to the nearest step (discrete, no in-between).
    return snapStep ? Math.round(x / snapStep) * snapStep : x;
  };

  // Tick mark positions (only when stepped).
  const ticks =
    snapStep && snapStep > 0
      ? Array.from({ length: Math.round(1 / snapStep) + 1 }, (_, i) => i * snapStep)
      : [];

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const nf = fracFromX(e.clientX);
        setDrag(nf);
        onLive(nf);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        const nf = fracFromX(e.clientX);
        setDrag(nf);
        onLive(nf);
      }}
      onPointerUp={(e) => {
        const nf = drag ?? fracFromX(e.clientX);
        onCommit(nf);
        setDrag(null);
      }}
      className="relative h-4 w-full cursor-pointer touch-none select-none"
    >
      {/* track */}
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary/20" />
      {/* tick marks (stepped sliders only) */}
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/30"
          style={{ left: `${t * 100}%` }}
        />
      ))}
      {/* filled portion */}
      <div
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary/50"
        style={{ width: `${f * 100}%` }}
      />
      {/* knob — matches the rotation dial knob */}
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-2 ring-white"
        style={{ left: `${f * 100}%` }}
      />
    </div>
  );
}

export function AdjustRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const MIN = 50;
  const MAX = 150;
  const toVal = (f: number) => Math.round(MIN + f * (MAX - MIN));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-[11px] text-gray-600">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="px-1">
        <MagSlider
          frac={(value - MIN) / (MAX - MIN)}
          onLive={(f) => onChange(toVal(f))}
          onCommit={(f) => onChange(toVal(f))}
          snapStep={0.1}
        />
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700">{value}</dd>
    </div>
  );
}

export function BarBtn({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      // Bigger touch target + icon on mobile (h-9/size-5), compact on desktop (h-7/size-4).
      // The [&_svg] rule scales the icon children regardless of their own h-4/w-4 classes.
      className={`flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 [&_svg]:size-5 md:h-7 md:w-7 md:[&_svg]:size-4 ${
        active ? "bg-primary/10 text-primary" : ""
      }`}
    >
      {children}
    </button>
  );
}

// Precise rotation dial (à la PathPresenter): a ring in the lower-right corner.
// Drag the knob anywhere on the ring to set the angle, scroll for 1° steps, double-
// click to reset. Center shows the current angle.
export function RotationDial({
  degrees,
  onChange,
  size = 76,
}: {
  degrees: number;
  onChange: (deg: number) => void;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const SIZE = size;
  const C = SIZE / 2;
  const R = SIZE / 2 - 7;

  const angleFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 0° = up, clockwise positive (matches screen rotation).
    const deg = (Math.atan2(clientX - cx, cy - clientY) * 180) / Math.PI;
    return (deg + 360) % 360;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(angleFromEvent(e.clientX, e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    onChange(angleFromEvent(e.clientX, e.clientY));
  };

  const rad = ((degrees - 90) * Math.PI) / 180; // -90 → 0° points up
  const hx = C + R * Math.cos(rad);
  const hy = C + R * Math.sin(rad);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onDoubleClick={() => onChange(0)}
      onWheel={(e) => onChange(degrees + (e.deltaY < 0 ? 1 : -1))}
      title="Rotate — drag the knob, scroll = 1°, double-click = reset"
      className="group absolute bottom-3 right-3 cursor-grab touch-none select-none opacity-85 drop-shadow transition-opacity hover:opacity-100 active:cursor-grabbing"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
        {/* white disc backing so the dial stays visible over any slide */}
        <circle cx={C} cy={C} r={R + 4} fill="white" fillOpacity="0.9" />
        {/* ring track */}
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-primary/40"
        />
        {/* knob */}
        <circle
          cx={hx}
          cy={hy}
          r={(SIZE * 0.072).toFixed(1)}
          className="fill-primary"
          stroke="white"
          strokeWidth="2"
        />
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-700"
          style={{ fontSize: SIZE * 0.158, fontWeight: 600 }}
        >
          {Math.round(degrees)}°
        </text>
      </svg>
    </div>
  );
}
