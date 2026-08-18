"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Home,
  Maximize2,
  Microscope,
  Camera,
  ImageDown,
  Search,
  Info,
  SlidersHorizontal,
  Layers,
} from "lucide-react";

import { buildOsdTileSource } from "@/shared/utils/domain/wsi-osd-tilesource";
import type { WsiTileSourceResult, RelatedSlide } from "@/shared/utils/domain/wsi-tilesource";
import { getRepositoryLogo } from "@/shared/components/common/repository-logos";
import {
  HIRES_WARN_MB,
  HIRES_OPTIONS,
  snap,
  fmtMag,
  buildExportName,
  estimateExportMB,
  nativeMagFromMpp,
  computeOnScreenMag,
  computeHiResDimensions,
  buildPanelItems,
  buildOsdOptions,
  navigatorSize,
} from "./self-hosted-osd-viewer-utils";
import {
  Sep,
  Popover,
  BarBtn,
  RotationDial,
  MagPanelBody,
  InfoPanelBody,
  AdjustPanelBody,
  RelatedPanelBody,
} from "./self-hosted-osd-viewer-parts";

// Approach 2: render a repo's slide in OUR OWN bundled OpenSeadragon against the repo's
// tile pyramid (resolved server-side via /api/public/tools/virtual-slides/wsi-tilesource). Bypasses the repo
// page's X-Frame-Options (no iframe) and shows just the viewer — no chrome — with a
// branded control bar + precise rotation dial instead of OSD's default buttons.

// Minimal shape of the OSD viewer methods we drive from React.
type Rect = { x: number; y: number; width: number; height: number };
type OsdViewer = {
  destroy: () => void;
  viewport: {
    zoomBy: (f: number) => void;
    goHome: (immediately?: boolean) => void;
    setRotation: (deg: number, immediately?: boolean) => void;
    getRotation: () => number;
    setFlip: (b: boolean) => void;
    getFlip: () => boolean;
    applyConstraints: () => void;
    getBounds: (current?: boolean) => Rect;
    getBoundsNoRotate: (current?: boolean) => Rect;
    fitBounds: (r: Rect, immediately?: boolean) => void;
    getZoom: (current?: boolean) => number;
    zoomTo: (zoom: number, refPoint?: unknown, immediately?: boolean) => void;
    getCenter: (current?: boolean) => { x: number; y: number };
    panTo: (p: { x: number; y: number }, immediately?: boolean) => void;
    // Image space: pixels of the slide, independent of the container's size.
    viewportToImageZoom: (zoom: number) => number;
    imageToViewportZoom: (zoom: number) => number;
    viewportToImageCoordinates: (p: { x: number; y: number }) => { x: number; y: number };
    imageToViewportCoordinates: (p: { x: number; y: number }) => { x: number; y: number };
  };
  world?: { getItemAt?: (i: number) => { getFullyLoaded?: () => boolean } | undefined };
  addHandler: (ev: string, cb: (event?: { message?: string }) => void) => void;
  addOnceHandler: (ev: string, cb: () => void) => void;
  drawer?: { canvas?: HTMLCanvasElement };
};

interface Props {
  slideUrl: string;
  // Tile source to resolve from, when it differs from slideUrl (e.g. LearnHaem: slideUrl is the
  // course page shown as the source link, while tiles come from a derived DZI URL). Defaults to slideUrl.
  tileSourceUrl?: string;
  // MGH only: a within-case slide name (/list hash) to open on, instead of the case's H&E
  // representative. Seeds activeSlide once at mount; later within-case nav uses the panel.
  initialSlide?: string;
  repository?: string;
  className?: string;
  heightClass?: string;
  forceDrawer?: "webgl" | "canvas";
  // Optional metadata for the Info panel prototype.
  info?: { diagnosis?: string; category?: string; subcategory?: string; stain?: string };
  // Corpus-driven related slides (case_groups). When provided, the left panel shows
  // these cross-WSI siblings and clicking calls onSelectRelated(slideUrl) to navigate.
  // When omitted, the panel falls back to the MGH within-case prototype (/api/public/tools/virtual-slides/wsi-related).
  relatedSlides?: {
    /** Stable identity. Required when several siblings share a slideUrl
     *  (LearnHaem cases all point at the same course page). */
    id?: string;
    label: string;
    thumbUrl?: string;
    slideUrl: string;
    stain?: string;
  }[];
  /** Receives the item's `id` when ids are supplied, otherwise its slideUrl. */
  onSelectRelated?: (idOrSlideUrl: string) => void;
  /** Id of the slide currently shown, when relatedSlides carry ids. */
  activeRelatedId?: string;
  // Fired the first time the viewer finishes loading a slide (status → ready). Lets a
  // host (e.g. the modal) reveal/expand its chrome only once tiles are actually showing.
  onReady?: () => void;
  // Fired when a slide fails to load (unsupported, or the source tile server is down).
  // Lets the host show a graceful message instead of hanging on its loading state.
  onError?: (message: string) => void;
  // The host renders its own control in the top-right corner (the dialog's close X).
  // Shifts the repository logo left so the two cannot overlap; inline viewers leave this
  // off and the logo sits at the same inset as the rotation dial.
  reservesTopRight?: boolean;
  // Fired when the viewer enters/leaves the CSS fullscreen fallback (used on browsers without
  // the element Fullscreen API, e.g. iOS Safari). The host expands its own container to the
  // full viewport — the wrapper can't escape a transformed ancestor (the dialog) on its own.
  onCssFullscreenChange?: (active: boolean) => void;
  // Bump to re-fit the slide to the container (goHome). The modal opens small (so OSD
  // initializes against a small element) then expands — without a refit the image would
  // stay at its small-window size, marooned in the big one.
  fitToken?: number;
  /**
   * Reopen at a view captured by an earlier mount. OSD's viewport dies with its
   * instance, so anything that remounts the viewer — switching page layout, for
   * one — otherwise drops the reader back to the fitted whole-slide view, at
   * whatever field they had spent the last minute finding.
   */
  initialView?: SavedView;
  /** Reports the view each time motion settles, so a host can hand it back later. */
  onViewChange?: (view: SavedView) => void;
}

/**
 * Where you were looking, in IMAGE space.
 *
 * Not viewport space, which is what OSD hands out by default: viewport zoom is a
 * fraction of the image's width, so the same number is a different magnification
 * in a container of a different size. Restoring it across a resize therefore
 * lands slightly off, `applyConstraints` trims whatever now overflows, the
 * trimmed value is what gets saved next time, and repeated round trips ratchet
 * the slide steadily outward. Image pixels do not move when the container does.
 */
export type SavedView = {
  /** Centre of the view, in slide pixels. */
  imageCenter: { x: number; y: number };
  /** Magnification: screen pixels per image pixel. */
  imageZoom: number;
  rotation: number;
  flip: boolean;
};

/**
 * Floor for the minimap, in viewer px. Below this it would cover a third of the
 * slide to show a thumbnail too small to aim with. OSD decides whether to build
 * it at init, so the same numbers are read twice: once there, once at render to
 * hide it if the viewer has since shrunk.
 */
const MINIMAP_MIN_W = 420;
const MINIMAP_MIN_H = 340;

/** Grace period before a hover menu closes, so the 8px gap to it is crossable. */
const HOVER_CLOSE_DELAY_MS = 260;

export function SelfHostedOSDViewer({
  slideUrl,
  tileSourceUrl,
  initialSlide,
  repository,
  className = "",
  heightClass = "h-[600px]",
  forceDrawer,
  info,
  relatedSlides,
  onSelectRelated,
  activeRelatedId,
  onReady,
  onError,
  reservesTopRight,
  onCssFullscreenChange,
  fitToken,
  initialView,
  onViewChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Kept in a ref so the init effect doesn't re-run when the host passes a new inline fn.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  // Mirrored, not in the effect deps: a host that rebuilds these on every render
  // would otherwise tear the viewer down and rebuild it each time.
  const initialViewRef = useRef(initialView);
  initialViewRef.current = initialView;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onCssFullscreenChangeRef = useRef(onCssFullscreenChange);
  onCssFullscreenChangeRef.current = onCssFullscreenChange;
  const viewerRef = useRef<OsdViewer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osdLibRef = useRef<any>(null);
  const tsRef = useRef<WsiTileSourceResult | null>(null);
  // Native scan magnification (from MPP: 40x≈0.25µm/px) + image width, for the loupe math.
  const magRef = useRef<{ nativeMag: number; imageW: number }>({ nativeMag: 40, imageW: 1 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // True once the viewer has loaded at least once. Lets us keep the chrome (toolbar,
  // Slides panel, dial) mounted while switching slides — only the canvas reloads, the
  // interface doesn't blink away behind a full-cover overlay.
  const [everReady, setEverReady] = useState(false);
  const [error, setError] = useState<string>("");
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panel, setPanel] = useState<null | "mag" | "info" | "hires" | "adjust" | "related">(null);
  const togglePanel = (p: "mag" | "info" | "hires" | "adjust" | "related") =>
    setPanel((cur) => (cur === p ? null : p));
  const [currentMag, setCurrentMag] = useState(1); // live (animating) — for the readout
  const [hiliteMag, setHiliteMag] = useState(1); // target/settled — for button highlight
  const [magKnown, setMagKnown] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const filterStr =
    brightness === 100 && contrast === 100 && saturation === 100
      ? ""
      : `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  // Height the minimap actually gets, so the related-slides rail can stop above it.
  // It varies with slide aspect and viewer size (22px to 260px measured), so a fixed
  // allowance either overlapped a tall minimap or wasted space beside a short one.
  const [navHeight, setNavHeight] = useState(0);
  // The viewer's OWN width. The toolbar has to react to this, not to the viewport:
  // an inline viewer sits in a 350px column inside a 1024px window, and a media
  // query sees only the window. Measured, so it works in any host layout.
  const [viewerWidth, setViewerWidth] = useState(0);
  const [viewerHeight, setViewerHeight] = useState(0);
  // The stain chip is centred, so whether it can share the toolbar's row depends on
  // what the toolbar and the logo actually measure — both vary (buttons drop out at
  // the widths below; the logo has two sizes and sometimes isn't there). Measured
  // rather than derived from a breakpoint, because the stain text is arbitrary too.
  const barRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const stainRef = useRef<HTMLDivElement>(null);
  const [stainOnBarRow, setStainOnBarRow] = useState(true);
  // Hover-to-open only where hovering is a real gesture. Touch devices synthesise
  // mouseenter on tap, which would make every menu open-then-immediately-toggle.
  const [hoverCapable, setHoverCapable] = useState(false);
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
    },
    []
  );
  const [isTainted, setIsTainted] = useState(false); // DZI repo — proxied so canvas stays clean
  const [busy, setBusy] = useState(false);
  // Related slides (MGH prototype): the case's H&E / special stains / levels.
  const [related, setRelated] = useState<RelatedSlide[]>([]);
  // Selected slide name. Seeded from initialSlide (MGH open-at-slide) so the first load resolves
  // that slide directly — no flash through the H&E representative first. Consumed (→ null on the
  // next case) by the related-fetch effect via initialSlideRef.
  const [activeSlide, setActiveSlide] = useState<string | null>(initialSlide ?? null);
  const initialSlideRef = useRef(initialSlide);
  const [slidesOpen, setSlidesOpen] = useState(false); // hover expands
  // Snapshot of the outgoing canvas, shown over the reload so the switch never flashes to
  // black (OSD destroys the live canvas immediately). `freezeVisible` drives the cover→fade.
  const [freezeUrl, setFreezeUrl] = useState<string | null>(null);
  const [freezeVisible, setFreezeVisible] = useState(false);
  // Drives the blur RAMP: the freeze cover mounts sharp (identical to the outgoing live
  // canvas, so the cover is seamless) then animates blur in — instead of popping to a
  // pre-blurred snapshot, which read as "blur appears out of nowhere".
  const [freezeBlur, setFreezeBlur] = useState(false);
  const freezeUrlRef = useRef<string | null>(null);
  freezeUrlRef.current = freezeUrl;
  // View (rotation/flip/image-space bounds) to re-apply on the next slide so it opens at
  // the same position/zoom/rotation instead of resetting to fit.
  const pendingViewRef = useRef<{
    center: { x: number; y: number };
    zoom: number;
    rotation: number;
    flip: boolean;
  } | null>(null);

  // A host-supplied view (see SavedView). Kept apart from pendingViewRef because
  // it is in image space and can only be converted once the image is open, and
  // because an in-viewer slide switch must still take precedence over it.
  const pendingImageViewRef = useRef<SavedView | null>(null);

  // Set when a corpus related-slide switch is in flight, so the slideUrl-change effect keeps
  // the freeze + pending view (cross-fade) instead of resetting them like a fresh open.
  const corpusSwitchRef = useRef(false);

  // Snapshot the current canvas + view so the next slide can open under a blurred cover at
  // the same position/zoom/rotation. Shared by MGH within-case nav (pickSlide) and corpus
  // related-slide nav (onPickItem). Tainted canvas (IIIF) can't snapshot → no freeze, plain reload.
  const captureForSwitch = useCallback(() => {
    const v = viewerRef.current;
    const c = v?.drawer?.canvas;
    if (v) {
      pendingViewRef.current = {
        center: v.viewport.getCenter(true),
        zoom: v.viewport.getZoom(true),
        rotation: v.viewport.getRotation(),
        flip: v.viewport.getFlip(),
      };
    }
    try {
      if (c) {
        setFreezeUrl(c.toDataURL("image/jpeg", 0.7));
        setFreezeVisible(true); // cover instantly so there's no black frame
        setFreezeBlur(false); // mount sharp…
        // …then ramp blur in next frame so the CSS filter transition runs (a value set in
        // the same paint as mount wouldn't animate). Two rAFs to clear the mount paint.
        requestAnimationFrame(() => requestAnimationFrame(() => setFreezeBlur(true)));
      }
    } catch {
      /* tainted canvas → no freeze, falls back to a plain reload */
    }
  }, []);

  // MGH within-case slide switch: snapshot, then reload via activeSlide.
  const pickSlide = useCallback(
    (name: string) => {
      if (name === (activeSlide ?? related[0]?.name)) return;
      captureForSwitch();
      setActiveSlide(name);
    },
    [activeSlide, related, captureForSwitch]
  );
  const logo = getRepositoryLogo(repository);

  // True while a button-initiated animated glide is running — during it the button
  // highlight is pinned to the destination (so it doesn't flash every preset passed).
  const glidingRef = useRef(false);

  // On-screen objective magnification = nativeMag × (screen px per image px).
  const computeMag = useCallback(() => {
    const v = viewerRef.current;
    const cw = containerRef.current?.clientWidth;
    if (!v || !cw) return null;
    const { nativeMag, imageW } = magRef.current;
    return computeOnScreenMag(nativeMag, v.viewport.getZoom(true), cw, imageW);
  }, []);
  // Live tick (zoom/animation): readout always tracks; highlight tracks too UNLESS a
  // programmatic glide is pinning it. → manual scroll/pinch updates both in real time.
  const updateMag = useCallback(() => {
    const m = computeMag();
    if (m == null) return;
    setCurrentMag(m);
    if (!glidingRef.current) setHiliteMag(m);
  }, [computeMag]);
  // Motion settled: release the pin and sync both.
  const onSettle = useCallback(() => {
    glidingRef.current = false;
    const m = computeMag();
    if (m != null) {
      setCurrentMag(m);
      setHiliteMag(m);
    }
    const v = viewerRef.current;
    if (v && onViewChangeRef.current) {
      try {
        const vp = v.viewport;
        onViewChangeRef.current({
          imageCenter: vp.viewportToImageCoordinates(vp.getCenter(true)),
          imageZoom: vp.viewportToImageZoom(vp.getZoom(true)),
          rotation: vp.getRotation(),
          flip: vp.getFlip(),
        });
      } catch {
        /* viewer torn down mid-settle — nothing worth reporting */
      }
    }
  }, [computeMag]);

  // immediate=true tracks the slider pointer; false (buttons) animates the zoom glide.
  const setMagnification = useCallback((target: number, immediate = false) => {
    const v = viewerRef.current;
    const cw = containerRef.current?.clientWidth;
    if (!v || !cw) return;
    const { nativeMag, imageW } = magRef.current;
    if (!immediate) glidingRef.current = true; // pin highlight through the glide
    v.viewport.zoomTo((target / nativeMag) * (imageW / cw), undefined, immediate);
    v.viewport.applyConstraints();
    setHiliteMag(target);
  }, []);

  // Fullscreen the WHOLE wrapper (not OSD's inner element) so the branded toolbar,
  // minimap, and rotation dial stay present and positioned in fullscreen. Listen for the
  // webkit-prefixed event too (Safari) so the icon state tracks native enter/exit.
  useEffect(() => {
    const d = document as Document & { webkitFullscreenElement?: Element };
    const onChange = () =>
      setIsFullscreen((d.fullscreenElement ?? d.webkitFullscreenElement) === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    if (!el) return;
    const d = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    // Native fullscreen currently active → exit it (covers webkit). onChange resets the icon.
    if (d.fullscreenElement ?? d.webkitFullscreenElement) {
      (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
      return;
    }
    // Already in the CSS fallback → leave it.
    if (isFullscreen) {
      setIsFullscreen(false);
      onCssFullscreenChangeRef.current?.(false);
      return;
    }
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (request) {
      try {
        const p = request.call(el);
        // Some browsers reject (e.g. permissions / unsupported on element) → CSS fallback.
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {
            setIsFullscreen(true);
            onCssFullscreenChangeRef.current?.(true);
          });
        }
      } catch {
        setIsFullscreen(true);
        onCssFullscreenChangeRef.current?.(true);
      }
    } else {
      // No element Fullscreen API at all (iOS Safari) → CSS pseudo-fullscreen via the host.
      setIsFullscreen(true);
      onCssFullscreenChangeRef.current?.(true);
    }
  }, [isFullscreen]);

  // Live brightness/contrast/saturation via a CSS filter on the OSD canvas (cheap, GPU).
  useEffect(() => {
    const c = viewerRef.current?.drawer?.canvas;
    if (c) c.style.filter = filterStr;
  }, [filterStr, status]);

  // Host asked for a refit (e.g. the modal finished expanding from its small loading size).
  useEffect(() => {
    if (fitToken === undefined) return;
    viewerRef.current?.viewport.goHome(true);
  }, [fitToken]);

  // Fetch the case's related slides (MGH only; [] otherwise) for the left panel.
  useEffect(() => {
    let cancelled = false;
    // Corpus related-slide nav (onPickItem captured a freeze first): keep the freeze +
    // pending view so the slideUrl change cross-fades like the MGH path, instead of
    // resetting to a fresh full-overlay load.
    if (corpusSwitchRef.current) {
      corpusSwitchRef.current = false;
      return () => {
        cancelled = true;
      };
    }
    // Keep the seeded initialSlide on the first run for this case (consume it so a later
    // slideUrl change resets to the H&E representative). useState already set it, so on the
    // first run this re-sets the same value (no-op); only later runs flip it to null.
    setActiveSlide(initialSlideRef.current ?? null);
    initialSlideRef.current = undefined;
    setRelated([]);
    setEverReady(false); // new case → allow the full loading overlay
    setFreezeUrl(null);
    setFreezeVisible(false);
    setFreezeBlur(false);
    pendingViewRef.current = null;
    // Corpus-driven mode supplies siblings via props — skip the MGH directory fetch.
    if (relatedSlides) {
      return () => {
        cancelled = true;
      };
    }
    fetch(`/api/public/tools/virtual-slides/wsi-related?slideUrl=${encodeURIComponent(slideUrl)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRelated(d.slides ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slideUrl, relatedSlides]);

  // Auto-close the open popover on any click outside the toolbar or a panel.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-pb-popover]")) setPanel(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [panel]);

  useEffect(() => {
    let cancelled = false;
    let viewer: OsdViewer | null = null;
    // Hoisted so the effect cleanup can clear a pending failure timer (set on the
    // tile-load-failed path) — otherwise it could fire setState after teardown.
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      setStatus("loading");
      setError("");
      setRotation(0);
      try {
        const res = await fetch(
          `/api/public/tools/virtual-slides/wsi-tilesource?slideUrl=${encodeURIComponent(tileSourceUrl ?? slideUrl)}${
            repository ? `&repository=${encodeURIComponent(repository)}` : ""
          }${activeSlide ? `&slide=${encodeURIComponent(activeSlide)}` : ""}`
        );
        // A 5xx returns an HTML/text error page, not JSON — guard so res.json() doesn't throw
        // a raw "Unexpected token …is not valid JSON" into the user-facing error card.
        if (!res.ok) {
          const msg = "Couldn't reach this slide's source repository — it may be down.";
          setError(msg);
          setStatus("error");
          onErrorRef.current?.(msg);
          return;
        }
        const ts = (await res.json()) as WsiTileSourceResult;
        if (cancelled) return;
        if (ts.kind === "unsupported") {
          setError(ts.reason);
          setStatus("error");
          onErrorRef.current?.(ts.reason);
          return;
        }
        setDims({ w: ts.width, h: ts.height });
        tsRef.current = ts;
        const tainted = ts.kind === "dzi";
        const iiif = ts.kind === "iiif";
        setIsTainted(tainted || iiif);
        // MPP → native objective mag (0.25µm/px ≈ 40x). Default 40x when unknown.
        const nativeMag = nativeMagFromMpp(ts.mpp);
        magRef.current = { nativeMag, imageW: ts.width };
        setMagKnown(!!ts.mpp);

        const OpenSeadragon = (await import("openseadragon")).default;
        osdLibRef.current = OpenSeadragon;
        // OSD logs EVERY cancelled tile at error level, including the ones it
        // cancels itself: pan or zoom away from a tile mid-flight, switch slides,
        // or unmount, and each in-flight request reports "Image load aborted".
        // Those are normal and the tiles serve fine on request (verified 200 for
        // the URLs that reported it) — but console.error surfaces them in the
        // Next.js error overlay as if something broke. Downgrade just that
        // message; every other tile failure still logs as an error.
        const osdConsole = (OpenSeadragon as unknown as { console: Record<string, unknown> })
          .console;
        if (osdConsole && !(osdConsole as { __pbPatched?: boolean }).__pbPatched) {
          const originalError = osdConsole.error as (...a: unknown[]) => void;
          osdConsole.error = (...args: unknown[]) => {
            if (args.some((a) => typeof a === "string" && a.includes("aborted"))) {
              return;
            }
            originalError.apply(osdConsole, args);
          };
          (osdConsole as { __pbPatched?: boolean }).__pbPatched = true;
        }
        if (cancelled || !containerRef.current) return;

        // DZI and IIIF (Wirtualny) tiles carry no CORS header. Route BOTH through our
        // CORS-adding proxy for the session → canvas stays clean, which enables WebGL,
        // direct screenshots, AND the snapshot-based cross-fade between related slides
        // (toDataURL on a tainted canvas throws → previously Wirtualny got a hard cut).
        const proxy = tainted || iiif;
        // Proxied tiles are same-origin (our route emits ACAO:*) → always canvas-clean.
        const corsClean = true;
        // WebGL drawer rejects tainted textures → only valid on CORS-clean hosts.
        const drawer =
          (forceDrawer ?? (corsClean ? "webgl" : "canvas")) === "webgl" && corsClean
            ? "webgl"
            : "canvas";
        // Always built; whether it SHOWS is decided at render from the measured
        // viewer size (MINIMAP_MIN_W/H → wsi-hide-minimap). Deciding here instead
        // would freeze the answer at init, and init is exactly when the answer is
        // least reliable: the modal opens small and expands, so a viewer destined
        // to be 1200px wide measures a few hundred at this moment and would never
        // get a minimap at all.
        const showNavigator = true;
        // Same inputs as buildOsdOptions, so the rail reserves exactly what the
        // minimap takes rather than a guess.
        const navBox = showNavigator
          ? navigatorSize(
              ts.width,
              ts.height,
              containerRef.current.clientWidth,
              containerRef.current.clientHeight
            )
          : null;
        setNavHeight(navBox ? parseFloat(navBox.navigatorHeight) : 0);
        viewer = OpenSeadragon(
          buildOsdOptions({
            element: containerRef.current,
            tileSources: buildOsdTileSource(ts, { proxy }),
            drawer,
            corsClean,
            showNavigator,
            // Sizes the minimap box to this slide's aspect (see navigatorSize).
            imageWidth: ts.width,
            imageHeight: ts.height,
            containerWidth: containerRef.current.clientWidth,
            containerHeight: containerRef.current.clientHeight,
          })
        ) as unknown as OsdViewer;

        viewerRef.current = viewer;
        // Only when a related-slide switch has not already staged its own view:
        // an in-viewer navigation is about this slide, and wins.
        if (!pendingViewRef.current && initialViewRef.current) {
          pendingImageViewRef.current = initialViewRef.current;
        }
        viewer.addHandler("open", updateMag);
        viewer.addHandler("zoom", updateMag);
        viewer.addHandler("resize", updateMag);
        viewer.addHandler("animation", updateMag);
        viewer.addHandler("open", onSettle);
        viewer.addHandler("animation-finish", onSettle);

        // Source server down / slide gone. Custom tilesources (Aperio/Leeds/IIIF) "open"
        // immediately off their metadata, so a dead tile host never fires open-failed — the
        // tiles just 404 silently and the canvas stays blank. Watch for that: if no tile has
        // loaded a short while after the first failure, surface a graceful error.
        let gotTile = false;
        const fail = (msg: string) => {
          if (cancelled || gotTile) return;
          setError(msg);
          setStatus("error");
          onErrorRef.current?.(msg);
        };
        viewer.addHandler("tile-loaded", () => {
          gotTile = true;
        });
        viewer.addHandler("tile-load-failed", (e) => {
          // An aborted request is OSD cancelling its own work, not the host
          // failing — counting it here could show "server isn't responding" to
          // someone who simply panned quickly before the first tile landed.
          if (e?.message?.includes("aborted")) return;
          if (gotTile || cancelled || failTimer) return;
          failTimer = setTimeout(
            () => fail("The source server isn't responding for this slide — it may be down."),
            2500
          );
        });
        viewer.addHandler("open-failed", () =>
          fail("Couldn't open this slide from its source repository.")
        );
        // On open: re-apply the saved view (same position/zoom/rotation as the previous
        // slide) under the freeze cover, then fade the freeze once the region has loaded.
        viewer.addOnceHandler("open", () => {
          const v = viewer!;
          const pv = pendingViewRef.current;
          if (pv) {
            try {
              v.viewport.setRotation(pv.rotation, true);
              if (pv.flip) v.viewport.setFlip(true);
              // Restore exact zoom + center (rotation-agnostic) — fitBounds would re-derive
              // zoom from the rotated bbox and shrink it on each rotated switch.
              v.viewport.zoomTo(pv.zoom, undefined, true);
              v.viewport.panTo(pv.center, true);
              v.viewport.applyConstraints();
              setRotation(((pv.rotation % 360) + 360) % 360);
            } catch {
              /* dimensions mismatch — fall back to default open view */
            }
            pendingViewRef.current = null;
          }
          const iv = pendingImageViewRef.current;
          if (iv) {
            try {
              const vp = v.viewport;
              vp.setRotation(iv.rotation, true);
              if (iv.flip) vp.setFlip(true);
              // Converted here, not at capture: both conversions need the image's
              // dimensions, which exist only once it is open.
              vp.zoomTo(vp.imageToViewportZoom(iv.imageZoom), undefined, true);
              vp.panTo(vp.imageToViewportCoordinates(iv.imageCenter), true);
              vp.applyConstraints();
              setRotation(((iv.rotation % 360) + 360) % 360);
            } catch {
              /* dimensions mismatch — fall back to the default open view */
            }
            pendingImageViewRef.current = null;
          }
          if (freezeUrlRef.current) {
            const t0 = Date.now();
            const poll = () => {
              const loaded = v.world?.getItemAt?.(0)?.getFullyLoaded?.();
              if (loaded || Date.now() - t0 > 1500) setFreezeVisible(false);
              else setTimeout(poll, 120);
            };
            setTimeout(poll, 80);
          }
        });
        setStatus("ready");
        setEverReady(true);
        onReadyRef.current?.();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to initialize viewer";
        setError(msg);
        setStatus("error");
        onErrorRef.current?.(msg);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (failTimer) clearTimeout(failTimer);
      viewer?.destroy();
      viewerRef.current = null;
    };
  }, [slideUrl, tileSourceUrl, repository, forceDrawer, activeSlide, updateMag, onSettle]);

  const applyRotation = useCallback((deg: number) => {
    const v = viewerRef.current;
    if (!v) return;
    // Snap to 0/90/180/270 when close, so square orientations are easy to hit.
    const norm = ((snap(deg) % 360) + 360) % 360;
    // immediately=true → no easing animation, so the dial tracks the pointer in real time.
    v.viewport.setRotation(norm, true);
    setRotation(norm);
  }, []);

  const zoom = useCallback((factor: number) => {
    const v = viewerRef.current;
    if (!v) return;
    v.viewport.zoomBy(factor);
    v.viewport.applyConstraints();
  }, []);

  // Rough PNG size estimate for a hi-res export (~2 bytes/px for detailed tissue).
  const estMB = useCallback((px: number) => {
    const cw = containerRef.current?.clientWidth || 800;
    const ch = containerRef.current?.clientHeight || 600;
    return estimateExportMB(px, cw, ch);
  }, []);

  // Filename embeds diagnosis, repository, category, magnification and resolution.
  const buildName = useCallback(
    (resLabel: string) =>
      buildExportName({
        diagnosis: info?.diagnosis,
        repository,
        category: info?.category,
        mag: computeMag() ?? 1,
        resLabel,
      }),
    [info, repository, computeMag]
  );

  const download = useCallback((href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  }, []);

  // Export a canvas → PNG data URL, baking in the brightness/contrast filter if set.
  const exportCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!filterStr) return canvas.toDataURL("image/png");
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const ctx = tmp.getContext("2d");
      if (!ctx) return canvas.toDataURL("image/png");
      ctx.filter = filterStr;
      ctx.drawImage(canvas, 0, 0);
      return tmp.toDataURL("image/png");
    },
    [filterStr]
  );

  // WYSIWYG screen-res — direct export of the live (proxied/clean) canvas.
  const capture = useCallback(() => {
    const canvas = viewerRef.current?.drawer?.canvas;
    if (!canvas) return;
    try {
      download(exportCanvas(canvas), buildName(`${canvas.width}px`));
    } catch {
      /* tainted — shouldn't happen (DZI is proxied) */
    }
  }, [download, exportCanvas, buildName]);

  // High-res WYSIWYG — render a hidden OSD (proxied if DZI) at ~4K matched to the
  // current view, WAIT for full tile load (no missing segments), then export. The
  // larger canvas makes OSD pull a finer DZI level → genuinely more detail. Rotation
  // + flip are reproduced natively, so framing matches the screen.
  const captureHiRes = useCallback(
    async (px: number) => {
      setPanel(null);
      const v = viewerRef.current;
      const OSD = osdLibRef.current;
      const ts = tsRef.current;
      if (!v || !OSD || !ts || ts.kind === "unsupported" || busy) return;
      // Warn before a heavy export (rough estimate; PNG size varies with content).
      const mb = estMB(px);
      if (
        mb > HIRES_WARN_MB &&
        !window.confirm(
          `This export is roughly ${Math.round(mb)} MB and may take a while. Download anyway?`
        )
      ) {
        return;
      }
      setBusy(true);
      const liveW = containerRef.current?.clientWidth || 800;
      const liveH = containerRef.current?.clientHeight || 600;
      const { width: W, height: H } = computeHiResDimensions(px, liveW, liveH);
      // Un-rotated viewport rect — the hidden viewer re-applies rotation itself, so the
      // framing matches WYSIWYG (getBounds(true) would be the larger rotated bbox → black corners).
      const bounds = v.viewport.getBoundsNoRotate(true);
      const rot = v.viewport.getRotation();
      const flip = v.viewport.getFlip();

      const host = document.createElement("div");
      host.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;`;
      document.body.appendChild(host);
      let shot: OsdViewer | null = null;
      try {
        shot = OSD({
          element: host,
          tileSources: buildOsdTileSource(ts, { proxy: isTainted }),
          crossOriginPolicy: "Anonymous",
          drawer: "canvas",
          showNavigator: false,
          showNavigationControl: false,
          immediateRender: true,
          animationTime: 0,
          maxImageCacheCount: 2000,
        }) as unknown as OsdViewer;

        await new Promise<void>((resolve) => {
          const t0 = Date.now();
          const poll = () => {
            const loaded = shot?.world?.getItemAt?.(0)?.getFullyLoaded?.();
            if (loaded || Date.now() - t0 > 15000) resolve();
            else setTimeout(poll, 150);
          };
          shot!.addOnceHandler("open", () => {
            shot!.viewport.setRotation(rot, true);
            if (flip) shot!.viewport.setFlip(true);
            shot!.viewport.fitBounds(bounds, true);
            setTimeout(poll, 400);
          });
          setTimeout(resolve, 18000); // hard cap
        });

        const canvas = shot?.drawer?.canvas;
        if (canvas) {
          const label = HIRES_OPTIONS.find((o) => o.px === px)?.label ?? `${px}px`;
          download(exportCanvas(canvas), buildName(label));
        }
      } finally {
        shot?.destroy();
        host.remove();
        setBusy(false);
      }
    },
    [busy, isTainted, download, exportCanvas, buildName, estMB]
  );

  // Keep the interface mounted during an in-case slide switch (everReady) so it doesn't
  // blink away; only a brand-new case (status loading, never ready) hides the chrome.
  const showChrome = status === "ready" || everReady;

  // Related-slides panel items. Corpus mode (relatedSlides prop) navigates across WSIs;
  // otherwise the MGH within-case prototype (`related` + pickSlide/activeSlide).
  const corpusMode = relatedSlides !== undefined;
  // Vertical room the related-slides rail/panel may use: the band between the
  // toolbar and the minimap, derived rather than guessed.
  //
  //   viewer height − rail top − gap − minimap inset − minimap height
  //
  // The minimap's height is MEASURED (it sizes itself per slide, 22px to 260px),
  // so a fixed allowance was wrong in both directions: it overlapped a tall
  // minimap and wasted space beside a short one. The gap below the rail is set to
  // the same 36px that sits between the toolbar and the rail above it, so the
  // panel is evenly spaced between the two rather than crowding the minimap.
  // Toolbar shrink points, in VIEWER px (measured: 454px with the wordmark,
  // ~330px without; the logo needs ~128px of clearance beside it).
  const showWordmark = viewerWidth === 0 || viewerWidth >= 600;
  const compactBar = viewerWidth > 0 && viewerWidth < 460;
  // Below this only fit-to-view, magnification and fullscreen survive — enough to
  // navigate a slide, and narrow enough to clear the logo without clipping.
  const minimalBar = viewerWidth > 0 && viewerWidth < 400;
  // Menus are anchored 12px from the viewer's left edge; keep them inside it.
  const popoverMax = viewerWidth > 0 ? Math.max(180, viewerWidth - 24) : undefined;

  // The rest of the chrome drops out in a fixed order as the viewer narrows —
  // same measured width the toolbar uses, so every corner agrees about how much
  // room there is. It used to be split: the toolbar measured itself while the
  // logo, magnification and stain chip read `md:` media queries, i.e. the
  // WINDOW. Any layout where the two disagree — a viewer in a column, a narrow
  // window around a roomy viewer — put the logo in the wrong corner at mobile
  // size, on top of a minimap the window-sized check had decided to keep.
  //
  // Stain goes first (the Info panel still lists it), then the logo (the "Slide
  // © …" line still carries attribution), then the dial and minimap, which are
  // the two that need real estate rather than a slot.
  //
  // Corners are fixed, so nothing ever changes place: toolbar and attribution
  // top-left, logo top-right, minimap bottom-left, stain + magnification
  // bottom-centre, rotation dial bottom-right.
  const showStain = viewerWidth === 0 || viewerWidth >= 360;
  const showLogo = viewerWidth === 0 || viewerWidth >= 300;
  const showDial = viewerWidth === 0 || (viewerWidth >= 340 && viewerHeight >= 320);
  const roomForMinimap =
    viewerWidth === 0 || (viewerWidth >= MINIMAP_MIN_W && viewerHeight >= MINIMAP_MIN_H);

  const RAIL_TOP_PX = 84; // top-21
  const CHROME_GAP_PX = 36; // toolbar bottom (48) → rail top (84)
  const MINIMAP_INSET_PX = 12; // minimap's own bottom/left inset
  // A hidden minimap reserves nothing.
  const reservedNav = roomForMinimap ? navHeight : 0;
  const railLimit = `calc(100% - ${RAIL_TOP_PX + CHROME_GAP_PX + MINIMAP_INSET_PX + reservedNav}px)`;

  useEffect(() => {
    // `(hover: hover)` alone, deliberately: pairing it with `(pointer: fine)`
    // also excluded hybrids whose PRIMARY pointer is coarse (touch laptops with a
    // mouse attached) even though hovering works there. Touch-only devices still
    // report `hover: none` and keep the tap-to-toggle behaviour.
    //
    // NB: DevTools device emulation forces `hover: none`, so hover menus are off
    // while the device toolbar is active — that is emulation being accurate, not
    // a bug.
    const mq = window.matchMedia("(hover: hover)");
    const sync = () => setHoverCapable(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Open on hover, close on leave. The popover lives INSIDE this wrapper, so
  // moving the pointer from the button onto the menu never leaves it — no
  // close-delay timer needed. Click still toggles, for keyboard and touch.
  const hoverPanel = (key: "mag" | "info" | "hires" | "adjust") => ({
    onMouseEnter: () => {
      if (!hoverCapable) return;
      if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = null;
      setPanel(key);
    },
    onMouseLeave: () => {
      if (!hoverCapable) return;
      // Grace period. The menu is offset 8px below its button (mt-2), so the
      // pointer leaves the trigger before it reaches the menu — closing on the
      // bare mouseleave made the menu impossible to actually reach. The timer is
      // cancelled the moment anything in the group is re-entered, including the
      // menu itself and the transparent bridge across the gap.
      if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = setTimeout(() => setPanel(null), HOVER_CLOSE_DELAY_MS);
    },
  });

  // Where hover already opened the menu, a click must not toggle it shut — the
  // pointer is still over the button, so it would reopen on the next mousemove
  // and read as a broken toggle. Click just asserts "open" there; leaving closes.
  // Without hover (touch, keyboard) it stays a plain toggle.
  const openPanel = (key: "mag" | "info" | "hires" | "adjust") =>
    hoverCapable ? setPanel(key) : togglePanel(key);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setViewerWidth(entry.contentRect.width);
      setViewerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    const box = el.getBoundingClientRect();
    setViewerWidth(box.width);
    setViewerHeight(box.height);
    return () => ro.disconnect();
  }, []);

  const panelItems = buildPanelItems(
    corpusMode,
    relatedSlides,
    related,
    slideUrl,
    activeSlide,
    activeRelatedId
  );
  // "Related" count = siblings of the current slide, i.e. excluding the one on screen. Matches
  // the search-row count outside the viewer (panelItems includes the current slide itself).
  const relatedCount = Math.max(0, panelItems.length - 1);

  // Can the centred stain chip share the toolbar's row? Only if half the viewer,
  // minus whatever the toolbar (left) and logo (right) occupy, still leaves room
  // for half the chip plus a gap. Re-measured after paint whenever any of those
  // can have changed. `useLayoutEffect` so the chip never paints in the wrong row
  // first — the flicker would be on every resize.
  useLayoutEffect(() => {
    if (!showChrome || !info?.stain) return;
    const chip = stainRef.current;
    const wrapper = wrapperRef.current;
    if (!chip || !wrapper) return;

    const GAP = 12;
    const half = wrapper.getBoundingClientRect().width / 2;
    const need = chip.getBoundingClientRect().width / 2 + GAP;
    const bar = barRef.current?.getBoundingClientRect().width ?? 0;
    const mark = logoRef.current?.getBoundingClientRect().width ?? 0;
    // Both are inset 12px from their edge; the logo yields to a host control at 56px.
    const leftFree = half - (12 + bar);
    const rightFree = half - ((reservesTopRight ? 56 : 12) + mark);
    setStainOnBarRow(leftFree >= need && rightFree >= need);
  }, [
    showChrome,
    info?.stain,
    viewerWidth,
    showLogo,
    compactBar,
    minimalBar,
    showWordmark,
    reservesTopRight,
    relatedCount,
  ]);

  const onPickItem = (key: string) => {
    if (!corpusMode) return pickSlide(key);
    if (key === (activeRelatedId ?? slideUrl)) return;
    // Snapshot before the parent swaps slideUrl, then flag the upcoming slideUrl effect to
    // keep the freeze for a cross-fade (same feel as the MGH within-case path).
    captureForSwitch();
    corpusSwitchRef.current = true;
    onSelectRelated?.(key);
  };

  // Menu bodies — shared verbatim between the anchored popovers and the touch
  // bottom sheets so each control reads identically in both (sizing is responsive inside
  // each part). Extracted to self-hosted-osd-viewer-parts.tsx.
  const magBody = (
    <MagPanelBody
      hiliteMag={hiliteMag}
      currentMag={currentMag}
      onSetMagnification={setMagnification}
    />
  );

  const infoBody = <InfoPanelBody info={info} repository={repository} dims={dims} />;

  const adjustBody = (
    <AdjustPanelBody
      brightness={brightness}
      contrast={contrast}
      saturation={saturation}
      onBrightness={setBrightness}
      onContrast={setContrast}
      onSaturation={setSaturation}
    />
  );

  const relatedBody = (
    <RelatedPanelBody
      items={panelItems}
      onPick={(key) => {
        onPickItem(key);
        setPanel(null);
      }}
    />
  );

  return (
    <div
      ref={wrapperRef}
      className={`wsi-squircle relative w-full overflow-hidden bg-black ${roomForMinimap ? "" : "wsi-hide-minimap"} ${isFullscreen ? "h-screen" : heightClass} ${className}`}
    >
      {/* OSD renders into a box 1px larger than the viewer on every side, and the
          wrapper's overflow-hidden clips that ring away. OSD can settle a
          fraction of a pixel off its own bounds, which exposes the black backdrop
          as a hairline along an edge; hiding the outermost pixel removes the
          class of artifact rather than chasing each instance. Nothing is
          resampled — the tiles just render into a slightly bigger viewport, and
          the chrome is positioned against the wrapper so its insets are
          unaffected. */}
      <div ref={containerRef} className="wsi-osd-bleed bg-black" />

      {/* In-case slide switch: cover with the outgoing canvas snapshot instantly (no black
          frame), then blur + fade it out once the next slide has loaded at the same view. */}
      {freezeUrl && (
        <>
          {/* Exact overlap of the outgoing canvas (same size/position) — gentle constant
              blur, fades out on opacity only as the next slide loads in. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={freezeUrl}
            alt=""
            aria-hidden
            onTransitionEnd={(e) => {
              // Only retire the cover when the OPACITY fade-out finishes (the blur ramp also
              // fires transitionEnd, but mid-switch the cover must stay).
              if (e.propertyName === "opacity" && !freezeVisible) setFreezeUrl(null);
            }}
            style={{
              opacity: freezeVisible ? 1 : 0,
              filter: freezeBlur ? "blur(6px)" : "blur(0px)",
              // Blur ramps in slowly (1100ms) so the image visibly softens; opacity fades out
              // quickly (650ms) for a snappier dissolve into the newly loaded slide.
              transition: "opacity 650ms ease-in-out, filter 1100ms ease-out",
            }}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          />
          {freezeVisible && (
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white drop-shadow-lg" />
            </div>
          )}
        </>
      )}

      {/* Branded control bar — compact, left-aligned pill (same look in both orientations). */}
      {showChrome && (
        <div
          ref={barRef}
          data-pb-popover
          // NO overflow clipping here. `overflow-x: auto` also forces overflow-y to
          // auto, which clipped every popover — they are absolutely positioned
          // ~72px BELOW the bar. The bar is kept inside the viewer by dropping
          // buttons at the widths below instead, which is also what keeps it clear
          // of the repository logo.
          // Frosted glass (85% + blur + saturate) is applied to the SMALL chrome only —
          // icons and short labels. The menus, the related-slides panel and the mobile
          // sheet stay near-opaque on purpose: they carry sustained reading over
          // high-contrast tissue, and the muted secondary labels lose legibility first.
          className="absolute top-3 left-3 z-30 flex items-center gap-1 rounded-lg px-2 py-1 shadow-md ring-1 ring-black/5"
        >
          {/* The glass is a sibling layer BEHIND the buttons, not the bar itself.
              An element with backdrop-filter becomes the backdrop root for its
              descendants, so while the glass lived on the bar every popover inside
              it sampled the BAR rather than the slide — and popovers hang below the
              bar's box, so they sampled nothing and showed no blur at all. */}
          <div
            aria-hidden
            className="wsi-glass pointer-events-none absolute inset-0 -z-10 rounded-lg"
          />
          <span className="flex items-center gap-1.5 pr-1 text-primary select-none [&_svg]:size-5 md:[&_svg]:size-4">
            <Microscope />
            {showWordmark && (
              <span className="text-sm font-semibold whitespace-nowrap">Pathology Bites</span>
            )}
          </span>
          <Sep />
          {/* Zoom buttons are pinch-to-zoom on touch → desktop only, and the first
              thing to go when the viewer itself is narrow. */}
          <span className={compactBar ? "hidden" : "hidden md:contents"}>
            <BarBtn title="Zoom in" onClick={() => zoom(1.4)}>
              <Plus className="h-4 w-4" />
            </BarBtn>
            <BarBtn title="Zoom out" onClick={() => zoom(1 / 1.4)}>
              <Minus className="h-4 w-4" />
            </BarBtn>
          </span>
          <BarBtn
            title="Fit to view (resets rotation)"
            onClick={() => {
              const v = viewerRef.current;
              if (!v) return;
              v.viewport.goHome();
              v.viewport.setRotation(0); // animated glide back to upright (not immediate)
              v.viewport.setFlip(false);
              setRotation(0);
            }}
          >
            <Home className="h-4 w-4" />
          </BarBtn>
          <Sep />
          {/* Magnification — popover anchored under the loupe */}
          <div className="relative" {...hoverPanel("mag")}>
            <BarBtn title="Magnification" active={panel === "mag"} onClick={() => openPanel("mag")}>
              <Search className="h-4 w-4" />
            </BarBtn>
            {hoverCapable && panel === "mag" && (
              <Popover maxWidth={popoverMax} className="w-80 p-2">
                {magBody}
              </Popover>
            )}
          </div>
          {/* Photo + hi-res export are pointer workflows → the second thing dropped
              when the viewer itself is narrow. */}
          <span className={minimalBar ? "hidden" : "hidden md:contents"}>
            <BarBtn title="Photo — current view (PNG)" onClick={capture}>
              <Camera className="h-4 w-4" />
            </BarBtn>
            {/* Hi-res export — resolution menu anchored under the picture icon */}
            <div className="relative" {...hoverPanel("hires")}>
              <BarBtn
                title="Photo — high resolution"
                active={panel === "hires"}
                onClick={() => openPanel("hires")}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageDown className="h-4 w-4" />
                )}
              </BarBtn>
              {hoverCapable && panel === "hires" && (
                <Popover maxWidth={popoverMax} className="w-36 p-1">
                  {HIRES_OPTIONS.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => captureHiRes(o.px)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <span>{o.label}</span>
                      <span className="text-[10px] text-gray-400">
                        ~{Math.round(estMB(o.px))} MB
                      </span>
                    </button>
                  ))}
                </Popover>
              )}
            </div>
          </span>
          {/* Slide info — panel anchored under the info icon */}
          <div className={minimalBar ? "hidden" : "relative"} {...hoverPanel("info")}>
            <BarBtn title="Slide info" active={panel === "info"} onClick={() => openPanel("info")}>
              <Info className="h-4 w-4" />
            </BarBtn>
            {hoverCapable && panel === "info" && (
              <Popover maxWidth={popoverMax} className="right-0 w-64 p-3 text-sm">
                <div className="mb-2 font-semibold text-gray-800">Slide info</div>
                {infoBody}
              </Popover>
            )}
          </div>
          {/* Brightness / contrast — popover anchored under the sliders icon */}
          <div className={minimalBar ? "hidden" : "relative"} {...hoverPanel("adjust")}>
            <BarBtn
              title="Brightness & contrast"
              active={panel === "adjust" || !!filterStr}
              onClick={() => openPanel("adjust")}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </BarBtn>
            {hoverCapable && panel === "adjust" && (
              <Popover maxWidth={popoverMax} className="w-52 p-3">
                {adjustBody}
              </Popover>
            )}
          </div>
          <BarBtn
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </BarBtn>
        </div>
      )}

      {/* Attribution disclaimer — under the toolbar; z below the menus so they cover it. */}
      {showChrome && (
        <div
          className={`pointer-events-none absolute left-3 top-[3.65rem] z-0 truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80 ${
            stainOnBarRow ? "max-w-[55%]" : "max-w-[38%]"
          }`}
        >
          Slide © {logo?.alt ?? repository ?? "source repository"} · Educational use only
        </div>
      )}

      {/* Related slides — without hover, a standalone pill below the attribution line
          opens the bottom sheet. Keyed to the INPUT, not the size: a hover rail is
          unusable with a finger at any width, and fine with a mouse at any width. */}
      {showChrome && !hoverCapable && panelItems.length > 1 && (
        <button
          onClick={() => togglePanel("related")}
          className={`absolute left-3 top-21 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md ring-1 ring-black/5 transition-colors ${
            panel === "related" ? "bg-primary text-primary-foreground" : "wsi-glass text-slate-600"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Related slides</span>
          <span className="tabular-nums opacity-70">{relatedCount}</span>
        </button>
      )}

      {/* Repository logo — top-right, to the LEFT of the Close (X) so they don't overlap.
          Click opens the slide on its source site. Below ~300px of viewer there is no
          room for both the toolbar and the logo; the "Slide © …" chip still carries
          attribution, so the mark yields. */}
      {showChrome && logo && showLogo && (
        <a
          ref={logoRef}
          href={slideUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open on ${logo.alt}`}
          className={`absolute top-3 flex items-center wsi-glass rounded-lg shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-lg ${
            compactBar ? "h-12 px-3" : "h-20 px-5"
          } ${reservesTopRight ? "right-14" : "right-3"}`}
        >
          <picture>
            <source srcSet={logo.avif} type="image/avif" />
            {/* Half height under the compact threshold: at full size the mark ate a
                third of a narrow viewer's width. */}
            <img
              src={logo.png}
              alt={logo.alt}
              className={`w-auto object-contain ${compactBar ? "h-7" : "h-14"}`}
            />
          </picture>
        </a>
      )}

      {/* Magnification readout — bottom-centre, clear of all four corners. */}
      {showChrome && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 block -translate-x-1/2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
          {magKnown ? "" : "~"}
          {fmtMag(currentMag)}
        </div>
      )}

      {/* Stain chip — top-centre. On the toolbar's own row when the width allows,
          otherwise dropped to the row below, level with the attribution line. The
          toolbar's width changes with the buttons it can afford, so which of the two
          applies is measured (see the layout effect) rather than assumed. */}
      {showChrome && info?.stain && showStain && (
        <div
          ref={stainRef}
          className={`pointer-events-none absolute left-1/2 z-20 flex h-9 max-w-[12rem] -translate-x-1/2 items-center truncate wsi-glass rounded-lg px-3 text-xs font-medium uppercase tracking-[0.13em] text-slate-500 shadow-md ring-1 ring-black/5 ${
            stainOnBarRow ? "top-3" : "top-[3.65rem]"
          }`}
        >
          {info.stain}
        </div>
      )}

      {/* Related slides panel (desktop) — left edge, vertically centered. Hover expands the
          WIDTH (collapsed = a tall rail hinting "more"). Without hover this is replaced
          by the bottom sheet (the Layers toolbar button), which a finger can actually use. */}
      {showChrome && hoverCapable && panelItems.length > 1 && (
        <div
          onMouseEnter={() => setSlidesOpen(true)}
          onMouseLeave={() => setSlidesOpen(false)}
          style={{
            width: slidesOpen
              ? isFullscreen
                ? "15rem"
                : "11rem"
              : isFullscreen
                ? "2.75rem"
                : "2.5rem",
            // Expanded: auto-fit the actual card content (card height varies with 1-/2-line
            // labels + placeholder vs thumbnail, so a per-item constant mis-sizes it).
            //
            // Collapsed: a rail sized by slide count, but clamped to a share of the
            // VIEWER as well. Slide count alone is unbounded — a Leeds case with 18
            // stains computes ~1900px — and relying on maxHeight to clip that left the
            // rail filling most of a tall viewer. The floor keeps a one-slide rail
            // grabbable; the ceiling keeps a big case from becoming the whole left edge.
            // Longer cases scroll within whatever height they end up with.
            height: slidesOpen
              ? undefined
              : `clamp(96px, ${44 + panelItems.length * (isFullscreen ? 140 : 104)}px, ${railLimit})`,
            maxHeight: railLimit,
          }}
          className="absolute left-3 top-21 z-10 flex flex-col overflow-hidden wsi-glass rounded-lg shadow-lg ring-1 ring-black/5 transition-all duration-200 ease-out"
        >
          {slidesOpen ? (
            <>
              <div className="flex h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-slate-500">
                <Layers className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Related slides</span>
                <span className="ml-auto tabular-nums">{relatedCount}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {panelItems.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => onPickItem(s.value)}
                    className={`block w-full rounded-md p-1.5 text-left ${
                      s.active ? "bg-primary/5 ring-2 ring-primary" : "hover:bg-black/5"
                    }`}
                  >
                    {/* Label wraps to two lines + tooltip — a single-line truncate could hide
                        what the slide is when there's no preview to go on. */}
                    <div className="mb-1 flex items-start gap-1 text-xs font-medium text-gray-700">
                      <span className="text-gray-400">{i + 1}.</span>
                      <span className="line-clamp-2 leading-snug" title={s.label}>
                        {s.label}
                      </span>
                    </div>
                    {/* Always render the image box: a real thumbnail, or a microscope
                        placeholder when the slide has no preview — keeps cards uniform and
                        avoids the off-looking empty gap. Stain chip shows in either case. */}
                    <div className="relative">
                      {s.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbUrl}
                          alt={s.label}
                          loading="lazy"
                          className={`w-full rounded object-contain ${
                            isFullscreen ? "h-24" : "h-16"
                          }`}
                        />
                      ) : (
                        <div
                          className={`flex w-full items-center justify-center rounded text-gray-300 ${
                            isFullscreen ? "h-24" : "h-16"
                          }`}
                        >
                          <Microscope className="h-6 w-6" />
                        </div>
                      )}
                      {s.stain && (
                        <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-[0.1em] text-slate-500 shadow-sm ring-1 ring-black/5">
                          {s.stain}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            // Collapsed rail: icon + count pinned top; uppercase label centered down the spine.
            <div className="flex h-full w-10 flex-col items-center gap-1.5 py-3 text-slate-500">
              <Layers className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium tabular-nums">{relatedCount}</span>
              <div className="flex flex-1 items-center justify-center">
                <span
                  style={{ writingMode: "vertical-rl" }}
                  className="rotate-180 whitespace-nowrap text-xs font-medium uppercase tracking-[0.13em] text-slate-500"
                >
                  Related slides
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rotation dial — lower-right ring (minimap is lower-left). Substantially
          larger without a pointer, and dropped entirely when the viewer is too small
          to spare the corner. */}
      {showChrome && showDial && (
        <RotationDial
          degrees={rotation}
          onChange={applyRotation}
          size={hoverCapable ? 76 : 124}
          touch={!hoverCapable}
        />
      )}

      {/* Without hover, menus render as a bottom sheet (never clipped, big touch targets)
          instead of anchored popovers. A scrim dims the slide; tapping it (outside the
          sheet's data-pb-popover) closes via the global outside-click handler. */}
      {!hoverCapable && panel && (
        <>
          <div className="absolute inset-0 z-30 bg-black/25" aria-hidden />
          <div
            data-pb-popover
            className="absolute inset-x-0 bottom-0 z-40 max-h-[72%] animate-in slide-in-from-bottom overflow-y-auto wsi-glass rounded-t-2xl p-4 pb-6 shadow-2xl ring-1 ring-black/5 duration-200"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
            <div className="mb-3 text-sm font-semibold text-gray-800">
              {panel === "mag"
                ? "Magnification"
                : panel === "info"
                  ? "Slide info"
                  : panel === "adjust"
                    ? "Image adjustments"
                    : panel === "related"
                      ? "Related slides"
                      : ""}
            </div>
            {panel === "mag" && magBody}
            {panel === "info" && infoBody}
            {panel === "adjust" && adjustBody}
            {panel === "related" && relatedBody}
          </div>
        </>
      )}

      {/* First load of a brand-new case → full overlay (in-case reloads use the blur above). */}
      {status === "loading" && !everReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tiles…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium">Self-hosted OSD unavailable</p>
          <p className="text-xs text-muted-foreground max-w-md">{error}</p>
        </div>
      )}
    </div>
  );
}
