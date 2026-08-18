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
  /** React identity. Unique even when several slides share a slideUrl. */
  key: string;
  /** What onSelectRelated receives — an id when the caller supplies one, else the URL. */
  value: string;
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
    | { id?: string; label: string; thumbUrl?: string; slideUrl: string; stain?: string }[]
    | undefined,
  related: { name: string; label: string; thumbUrl?: string }[],
  slideUrl: string,
  activeSlide: string | null,
  activeId?: string | null
): PanelItem[] {
  if (corpusMode) {
    // Key on `id` where the caller supplies one. slideUrl is NOT unique: a
    // LearnHaem case's slides all share the course-page URL and differ only by
    // their derived tile source, so keying on it collided in React AND made
    // every sibling in the case select the first one.
    return (relatedSlides ?? []).map((r, i) => ({
      key: r.id ?? `${r.slideUrl}#${i}`,
      // Callers that supply ids get ids back (and must match on them); callers
      // that don't keep the original URL contract unchanged.
      value: r.id ?? r.slideUrl,
      label: r.label,
      thumbUrl: r.thumbUrl,
      stain: r.stain,
      active: r.id && activeId ? r.id === activeId : r.slideUrl === slideUrl,
    }));
  }
  return related.map((r) => ({
    key: r.name,
    value: r.name,
    label: r.label,
    thumbUrl: r.thumbUrl,
    stain: undefined as string | undefined,
    active: (activeSlide ?? related[0]?.name) === r.name,
  }));
}

/** OpenSeadragon constructor options (static viewer config + the per-init dynamic bits). */
/**
 * Longest edge of the minimap, in px. The other edge follows the slide's aspect.
 *
 * OSD's default sizes the navigator box from `navigatorSizeRatio` and then
 * letterboxes the slide inside it, so the BOX was identical for every slide
 * (164x156 measured) while the slide within it was not: a portrait scan became a
 * thin vertical strip, a landscape one a short band, each floating in dead space.
 * That is what read as "the minimap changes size".
 *
 * Fixing the long edge instead makes the box track the slide, so the thumbnail
 * fills it and every minimap is drawn at the same scale.
 *
 * The long edge scales with the viewer, the way OSD's own `navigatorSizeRatio`
 * does — a fixed edge that looks right in the dialog is tiny in a small inline
 * viewer, and vice versa. Clamped at both ends so it stays usable in a narrow
 * panel and never eats a full-screen slide.
 *
 * Note the area trap: matching the OLD long edge (~164) made the minimap SMALLER
 * than before, because the old box was 164x156 for every slide while an
 * aspect-matched box at the same long edge is only 164x75 for a 2.2:1 scan —
 * under half the area. The ratio below is set from area, not edge length.
 */
const NAVIGATOR_SIZE_RATIO = 0.24;
const NAVIGATOR_MIN_EDGE = 170;
const NAVIGATOR_MAX_EDGE = 300;
/** Absolute bounds so the minimap stays legible without dominating the viewer. */
const NAVIGATOR_MAX_WIDTH = 340;
const NAVIGATOR_MAX_HEIGHT = 260;
const NAVIGATOR_MIN_WIDTH = 110;
const NAVIGATOR_MIN_HEIGHT = 110;
/**
 * Ceiling as a share of the viewer, in BOTH axes.
 *
 * The absolute bounds alone are not enough: `edge` has a 170px floor that ignored
 * the container, so a tall narrow viewer (142px wide, measured) produced a 251px
 * minimap — 177% of the viewer's own width. Anything relative has to be relative
 * to both dimensions, or one of them goes unchecked.
 */
const NAVIGATOR_MAX_FRACTION = 0.33;

/**
 * Navigator box matched to the slide's aspect ratio, holding AREA constant.
 *
 * Area, not long edge: fixing the long edge still shrinks a wide slide's minimap
 * to a thin band (a 2.2:1 scan at a 164 long edge is 164x75, well under half the
 * area of the old fixed box), which reads as "the minimap got small". Holding
 * area constant gives every minimap the same visual weight whatever the slide's
 * shape, which is what "the same size" actually means here.
 *
 * `edge` is the geometric mean of the two sides — the side length the box would
 * have if the slide were square — and is what scales with the viewer.
 */
export function navigatorSize(
  imageWidth?: number,
  imageHeight?: number,
  containerWidth?: number,
  containerHeight?: number
): { navigatorWidth: string; navigatorHeight: string } | null {
  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) return null;
  const cw = containerWidth || 900;
  const ch = containerHeight || 600;
  const edge = Math.min(
    NAVIGATOR_MAX_EDGE,
    Math.max(NAVIGATOR_MIN_EDGE, cw * NAVIGATOR_SIZE_RATIO)
  );
  // The box must match the slide's aspect EXACTLY. OSD fits the thumbnail inside
  // whatever box it is given and fills the remainder with the navigator's own
  // background, so any mismatch shows up as black bands across the minimap — an
  // earlier version clamped the aspect and forced a min height, and a ribbon-
  // shaped scan came out with a black rectangle above and below the tissue.
  const aspect = imageWidth / imageHeight;

  let w = edge * Math.sqrt(aspect);
  let h = edge / Math.sqrt(aspect);

  // Bounds are applied by scaling the WHOLE box, never by adjusting one side —
  // that is what keeps the aspect exact and the letterboxing gone.
  const maxW = Math.min(NAVIGATOR_MAX_WIDTH, cw * NAVIGATOR_MAX_FRACTION);
  const maxH = Math.min(NAVIGATOR_MAX_HEIGHT, ch * NAVIGATOR_MAX_FRACTION);
  // A minimum can never out-rank a maximum: in a small viewer the ceiling wins,
  // otherwise the minimap grows straight back through it.
  const minW = Math.min(NAVIGATOR_MIN_WIDTH, maxW);
  const minH = Math.min(NAVIGATOR_MIN_HEIGHT, maxH);

  // Shrink to fit both ceilings.
  const shrink = Math.min(1, maxW / w, maxH / h);
  w *= shrink;
  h *= shrink;

  // Then grow toward the floors, but never back past a ceiling. A ribbon-shaped
  // slide cannot satisfy both; it stays short rather than being stretched.
  const grow = Math.min(Math.max(1, minW / w, minH / h), maxW / w, maxH / h);
  w *= grow;
  h *= grow;

  return { navigatorWidth: `${Math.round(w)}px`, navigatorHeight: `${Math.round(h)}px` };
}

export function buildOsdOptions(args: {
  element: HTMLElement;
  tileSources: unknown;
  drawer: "webgl" | "canvas";
  corsClean: boolean;
  showNavigator: boolean;
  imageWidth?: number;
  imageHeight?: number;
  containerWidth?: number;
  containerHeight?: number;
}): Record<string, unknown> {
  const { element, tileSources, drawer, corsClean, showNavigator, imageWidth, imageHeight } = args;
  const containerWidth = args.containerWidth || element.clientWidth || undefined;
  const containerHeight = args.containerHeight || element.clientHeight || undefined;
  return {
    // Explicit navigator dimensions override navigatorSizeRatio. Spread first so
    // the keys below still win if they ever collide.
    ...(showNavigator
      ? (navigatorSize(imageWidth, imageHeight, containerWidth, containerHeight) ?? {})
      : {}),
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
    // Enforce the bounds continuously, not just at the end of a gesture. With this
    // off (OSD's default) a pan can settle a fraction of a pixel past the image
    // edge and the black backdrop shows as a hairline down that side — the thin
    // dark lines reported along the top/right edges at high zoom.
    constrainDuringPan: true,
    maxImageCacheCount: 600,
    imageLoaderLimit: 8,
    preserveImageSizeOnResize: true,
    gestureSettingsMouse: { flickEnabled: true },
    gestureSettingsTouch: { flickEnabled: true, flickMomentum: 0.4, pinchToZoom: true },
  };
}
