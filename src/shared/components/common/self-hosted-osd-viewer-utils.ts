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
const SNAP_DEG = 7;
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

/** Native objective magnification from microns-per-pixel (0.25µm/px ≈ 40×); 40× when unknown. */
export function nativeMagFromMpp(mpp: number | undefined): number {
  return mpp ? 10 / mpp : 40;
}

/** On-screen objective magnification = nativeMag × (screen px per image px). */
export function computeOnScreenMag(
  nativeMag: number,
  zoom: number,
  containerWidth: number,
  imageW: number
): number {
  return (nativeMag * (zoom * containerWidth)) / imageW;
}

/** Offscreen render dimensions for a hi-res export (scale up the live viewport to `px` long side). */
export function computeHiResDimensions(
  px: number,
  liveW: number,
  liveH: number
): { scale: number; width: number; height: number } {
  const scale = Math.max(1, px / Math.max(liveW, liveH));
  return { scale, width: Math.round(liveW * scale), height: Math.round(liveH * scale) };
}

export interface PanelItem {
  key: string;
  label: string;
  thumbUrl?: string;
  stain?: string;
  active: boolean;
}

/**
 * Build the related-slides panel list. Corpus mode (relatedSlides provided) navigates across WSIs
 * by slideUrl; otherwise the MGH within-case prototype keys off slide name + activeSlide.
 */
export function buildPanelItems(
  corpusMode: boolean,
  relatedSlides:
    | { label: string; thumbUrl?: string; slideUrl: string; stain?: string }[]
    | undefined,
  related: { name: string; label: string; thumbUrl?: string }[],
  slideUrl: string,
  activeSlide: string | null
): PanelItem[] {
  if (corpusMode) {
    return (relatedSlides ?? []).map((r) => ({
      key: r.slideUrl,
      label: r.label,
      thumbUrl: r.thumbUrl,
      stain: r.stain,
      active: r.slideUrl === slideUrl,
    }));
  }
  return related.map((r) => ({
    key: r.name,
    label: r.label,
    thumbUrl: r.thumbUrl,
    stain: undefined as string | undefined,
    active: (activeSlide ?? related[0]?.name) === r.name,
  }));
}

/** OpenSeadragon constructor options (static viewer config + the per-init dynamic bits). */
export function buildOsdOptions(args: {
  element: HTMLElement;
  tileSources: unknown;
  drawer: "webgl" | "canvas";
  corsClean: boolean;
  showNavigator: boolean;
}): Record<string, unknown> {
  const { element, tileSources, drawer, corsClean, showNavigator } = args;
  return {
    element,
    prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/",
    tileSources,
    crossOriginPolicy: corsClean ? "Anonymous" : false,
    drawer,
    // Keep the WebGL backbuffer so the Photo button's toDataURL isn't blank.
    drawerOptions: { webgl: { preserveDrawingBuffer: true } },
    // Default button groups OFF — we render our own branded bar below.
    showNavigationControl: false,
    showRotationControl: false,
    showFlipControl: false,
    showFullPageControl: false,
    showNavigator,
    navigatorPosition: "BOTTOM_LEFT",
    // Slower, finer zoom (smaller per-scroll step + longer glide).
    animationTime: 1.0,
    springStiffness: 5.5,
    zoomPerScroll: 1.15,
    blendTime: 0.1,
    immediateRender: false,
    preload: true,
    // Allow digital zoom past native so high mag presets (e.g. 100×) are reachable.
    maxZoomPixelRatio: 4,
    visibilityRatio: 1,
    maxImageCacheCount: 600,
    imageLoaderLimit: 8,
    preserveImageSizeOnResize: true,
    gestureSettingsMouse: { flickEnabled: true },
    gestureSettingsTouch: { flickEnabled: true, flickMomentum: 0.4, pinchToZoom: true },
  };
}
