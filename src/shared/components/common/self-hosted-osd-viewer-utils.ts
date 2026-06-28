// Pure helpers + constants for the self-hosted OSD viewer (rotation snapping,
// magnification scale mapping, export filename/size). Unit-tested in isolation
// (see self-hosted-osd-viewer-utils.test.ts).

// Standard objective magnifications offered by the loupe control. 2× and 60× are dropped only
// in the cramped mobile-portrait grid (see TIGHT_PRESETS).
export const MAG_PRESETS = [1, 2, 5, 10, 20, 40, 60, 100];
// Presets hidden in the mobile-portrait grid so the rest fit on one line.
export const TIGHT_PRESETS = new Set([2, 60]);
// Confirm before exporting hi-res images larger than this (rough estimate).
export const HIRES_WARN_MB = 25;
// Hi-res export resolutions (longer side, px).
export const HIRES_OPTIONS = [
  { label: "1K", px: 1024 },
  { label: "2K", px: 2048 },
  { label: "4K", px: 4096 },
  { label: "8K", px: 8192 },
];

// Snap to 0/90/180/270 when within this many degrees.
export const SNAP_DEG = 7;
export function snap(deg: number): number {
  const nearest = Math.round(deg / 90) * 90;
  return Math.abs(deg - nearest) <= SNAP_DEG ? nearest % 360 : deg;
}

export const MAG_MIN = 1;
export const MAG_MAX = 100;

export function fmtMag(m: number): string {
  if (m < 10) return `${m.toFixed(1)}×`;
  return `${Math.round(m)}×`;
}

/** Map a magnification (1×…100×) onto a 0..1 slider fraction (log scale). */
export function magToSlider(m: number): number {
  const c = Math.min(MAG_MAX, Math.max(MAG_MIN, m));
  return Math.log(c / MAG_MIN) / Math.log(MAG_MAX / MAG_MIN);
}

/** Inverse of magToSlider: a 0..1 slider fraction back to a magnification. */
export function sliderToMag(s: number): number {
  return MAG_MIN * Math.pow(MAG_MAX / MAG_MIN, s);
}

/** Slugify a metadata field for use in an export filename. */
export function slug(s?: string): string {
  return (s || "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Export filename embedding diagnosis, repository, category, magnification, resolution. */
export function buildExportName(fields: {
  diagnosis?: string;
  repository?: string;
  category?: string;
  mag: number;
  resLabel: string;
}): string {
  const { diagnosis, repository, category, mag, resLabel } = fields;
  return (
    [slug(diagnosis) || "slide", slug(repository), slug(category), `${Math.round(mag)}x`, resLabel]
      .filter(Boolean)
      .join("_") + ".png"
  );
}

/** Rough PNG size estimate for a hi-res export (~2 bytes/px for detailed tissue). */
export function estimateExportMB(px: number, containerW: number, containerH: number): number {
  const outH = Math.round((px * containerH) / containerW);
  return (px * outH * 2) / 1e6;
}
