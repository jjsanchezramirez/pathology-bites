"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// Approach 2: render a repo's slide in OUR OWN bundled OpenSeadragon against the repo's
// tile pyramid (resolved server-side via /api/debug/wsi-tilesource). Bypasses the repo
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
  };
  world?: { getItemAt?: (i: number) => { getFullyLoaded?: () => boolean } | undefined };
  addHandler: (ev: string, cb: () => void) => void;
  addOnceHandler: (ev: string, cb: () => void) => void;
  drawer?: { canvas?: HTMLCanvasElement };
};

// Standard objective magnifications offered by the loupe control.
const MAG_PRESETS = [1, 2, 5, 10, 20, 40, 60, 100];
// Confirm before exporting hi-res images larger than this (rough estimate).
const HIRES_WARN_MB = 25;
// Hi-res export resolutions (longer side, px).
const HIRES_OPTIONS = [
  { label: "1K", px: 1024 },
  { label: "2K", px: 2048 },
  { label: "4K", px: 4096 },
  { label: "8K", px: 8192 },
];

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
  // When omitted, the panel falls back to the MGH within-case prototype (/api/debug/wsi-related).
  relatedSlides?: { label: string; thumbUrl?: string; slideUrl: string; stain?: string }[];
  onSelectRelated?: (slideUrl: string) => void;
  // Fired the first time the viewer finishes loading a slide (status → ready). Lets a
  // host (e.g. the modal) reveal/expand its chrome only once tiles are actually showing.
  onReady?: () => void;
  // Fired when a slide fails to load (unsupported, or the source tile server is down).
  // Lets the host show a graceful message instead of hanging on its loading state.
  onError?: (message: string) => void;
  // Bump to re-fit the slide to the container (goHome). The modal opens small (so OSD
  // initializes against a small element) then expands — without a refit the image would
  // stay at its small-window size, marooned in the big one.
  fitToken?: number;
}

// Snap to 0/90/180/270 when within this many degrees.
const SNAP_DEG = 7;
function snap(deg: number): number {
  const nearest = Math.round(deg / 90) * 90;
  return Math.abs(deg - nearest) <= SNAP_DEG ? nearest % 360 : deg;
}

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
  onReady,
  onError,
  fitToken,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Kept in a ref so the init effect doesn't re-run when the host passes a new inline fn.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
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
  const [panel, setPanel] = useState<null | "mag" | "info" | "hires" | "adjust">(null);
  const togglePanel = (p: "mag" | "info" | "hires" | "adjust") =>
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
    return (nativeMag * (v.viewport.getZoom(true) * cw)) / imageW;
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
  // minimap, and rotation dial stay present and positioned in fullscreen.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapperRef.current?.requestFullscreen();
  }, []);

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
    fetch(`/api/debug/wsi-related?slideUrl=${encodeURIComponent(slideUrl)}`)
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

    async function init() {
      setStatus("loading");
      setError("");
      setRotation(0);
      try {
        const res = await fetch(
          `/api/debug/wsi-tilesource?slideUrl=${encodeURIComponent(tileSourceUrl ?? slideUrl)}${
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
        const nativeMag = ts.mpp ? 10 / ts.mpp : 40;
        magRef.current = { nativeMag, imageW: ts.width };
        setMagKnown(!!ts.mpp);

        const OpenSeadragon = (await import("openseadragon")).default;
        osdLibRef.current = OpenSeadragon;
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
        viewer = OpenSeadragon({
          element: containerRef.current,
          prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/",
          tileSources: buildOsdTileSource(ts, { proxy }) as never,
          crossOriginPolicy: corsClean ? "Anonymous" : false,
          drawer,
          // Keep the WebGL backbuffer so the Photo button's toDataURL isn't blank.
          drawerOptions: { webgl: { preserveDrawingBuffer: true } },
          // Default button groups OFF — we render our own branded bar below.
          showNavigationControl: false,
          showRotationControl: false,
          showFlipControl: false,
          showFullPageControl: false,
          // Minimap bottom-left.
          showNavigator: true,
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
        }) as unknown as OsdViewer;

        viewerRef.current = viewer;
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
        let failTimer: ReturnType<typeof setTimeout> | null = null;
        const fail = (msg: string) => {
          if (cancelled || gotTile) return;
          setError(msg);
          setStatus("error");
          onErrorRef.current?.(msg);
        };
        viewer.addHandler("tile-loaded", () => {
          gotTile = true;
        });
        viewer.addHandler("tile-load-failed", () => {
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
    const outH = Math.round((px * ch) / cw);
    return (px * outH * 2) / 1e6;
  }, []);

  // Filename embeds diagnosis, repository, category, magnification and resolution.
  const buildName = useCallback(
    (resLabel: string) => {
      const slug = (s?: string) =>
        (s || "")
          .replace(/[^\w]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();
      const mag = Math.round(computeMag() ?? 1);
      return (
        [
          slug(info?.diagnosis) || "slide",
          slug(repository),
          slug(info?.category),
          `${mag}x`,
          resLabel,
        ]
          .filter(Boolean)
          .join("_") + ".png"
      );
    },
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
      const f = Math.max(1, px / Math.max(liveW, liveH));
      const W = Math.round(liveW * f);
      const H = Math.round(liveH * f);
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
  const panelItems = corpusMode
    ? (relatedSlides ?? []).map((r) => ({
        key: r.slideUrl,
        label: r.label,
        thumbUrl: r.thumbUrl,
        stain: r.stain,
        active: r.slideUrl === slideUrl,
      }))
    : related.map((r) => ({
        key: r.name,
        label: r.label,
        thumbUrl: r.thumbUrl,
        stain: undefined as string | undefined,
        active: (activeSlide ?? related[0]?.name) === r.name,
      }));
  const onPickItem = (key: string) => {
    if (!corpusMode) return pickSlide(key);
    if (key === slideUrl) return;
    // Snapshot before the parent swaps slideUrl, then flag the upcoming slideUrl effect to
    // keep the freeze for a cross-fade (same feel as the MGH within-case path).
    captureForSwitch();
    corpusSwitchRef.current = true;
    onSelectRelated?.(key);
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden bg-black ${isFullscreen ? "h-screen" : heightClass} ${className}`}
    >
      <div ref={containerRef} className="w-full h-full bg-black" />

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

      {/* Branded control bar */}
      {showChrome && (
        <div
          data-pb-popover
          className="absolute top-2 left-2 z-30 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 shadow-md ring-1 ring-black/5 backdrop-blur"
        >
          <span className="flex items-center gap-1.5 pr-1 text-primary select-none">
            <Microscope className="h-4 w-4" />
            <span className="text-sm font-semibold whitespace-nowrap">Pathology Bites</span>
          </span>
          <Sep />
          <BarBtn title="Zoom in" onClick={() => zoom(1.4)}>
            <Plus className="h-4 w-4" />
          </BarBtn>
          <BarBtn title="Zoom out" onClick={() => zoom(1 / 1.4)}>
            <Minus className="h-4 w-4" />
          </BarBtn>
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
          <div className="relative">
            <BarBtn
              title="Magnification"
              active={panel === "mag"}
              onClick={() => togglePanel("mag")}
            >
              <Search className="h-4 w-4" />
            </BarBtn>
            {panel === "mag" && (
              <Popover className="w-64 p-2">
                <div className="flex justify-between gap-0.5">
                  {MAG_PRESETS.map((m) => {
                    const active = Math.abs(hiliteMag - m) / m < 0.15;
                    return (
                      <button
                        key={m}
                        onClick={() => setMagnification(m)}
                        className={`rounded px-1 py-0.5 text-[11px] font-medium tabular-nums ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {m}×
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 px-1">
                  <MagSlider
                    frac={magToSlider(currentMag)}
                    onLive={(f) => setMagnification(sliderToMag(f), true)}
                    onCommit={(f) => setMagnification(sliderToMag(f), true)}
                  />
                </div>
              </Popover>
            )}
          </div>
          <BarBtn title="Photo — current view (PNG)" onClick={capture}>
            <Camera className="h-4 w-4" />
          </BarBtn>
          {/* Hi-res export — resolution menu anchored under the picture icon */}
          <div className="relative">
            <BarBtn
              title="Photo — high resolution"
              active={panel === "hires"}
              onClick={() => togglePanel("hires")}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageDown className="h-4 w-4" />
              )}
            </BarBtn>
            {panel === "hires" && (
              <Popover className="w-36 p-1">
                {HIRES_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => captureHiRes(o.px)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span>{o.label}</span>
                    <span className="text-[10px] text-gray-400">~{Math.round(estMB(o.px))} MB</span>
                  </button>
                ))}
              </Popover>
            )}
          </div>
          {/* Slide info — panel anchored under the info icon */}
          <div className="relative">
            <BarBtn
              title="Slide info"
              active={panel === "info"}
              onClick={() => togglePanel("info")}
            >
              <Info className="h-4 w-4" />
            </BarBtn>
            {panel === "info" && (
              <Popover className="right-0 w-64 p-3 text-sm">
                <div className="mb-2 font-semibold text-gray-800">Slide info</div>
                <dl className="space-y-1 text-xs text-gray-600">
                  <InfoRow label="Diagnosis" value={info?.diagnosis} />
                  <InfoRow label="Repository" value={repository} />
                  <InfoRow label="Category" value={info?.category} />
                  <InfoRow label="Organ system" value={info?.subcategory} />
                  <InfoRow label="Stain" value={info?.stain} />
                  <InfoRow
                    label="Dimensions"
                    value={
                      dims
                        ? `${dims.w.toLocaleString()} × ${dims.h.toLocaleString()} px`
                        : undefined
                    }
                  />
                </dl>
              </Popover>
            )}
          </div>
          {/* Brightness / contrast — popover anchored under the sliders icon */}
          <div className="relative">
            <BarBtn
              title="Brightness & contrast"
              active={panel === "adjust" || !!filterStr}
              onClick={() => togglePanel("adjust")}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </BarBtn>
            {panel === "adjust" && (
              <Popover className="w-52 p-3">
                <AdjustRow label="Brightness" value={brightness} onChange={setBrightness} />
                <AdjustRow label="Contrast" value={contrast} onChange={setContrast} />
                <AdjustRow label="Saturation" value={saturation} onChange={setSaturation} />
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
        <div className="pointer-events-none absolute left-2 top-[3.4rem] z-0 max-w-[55%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80">
          Slide © {logo?.alt ?? repository ?? "source repository"} · Educational use only
        </div>
      )}

      {/* Stain chip — top-center, between the toolbar (left) and logo (right). Updates per
          slide on a related-slide switch. Violet to match the stain badge in the search rows. */}
      {showChrome && info?.stain && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 flex h-9 -translate-x-1/2 items-center rounded-lg bg-white/95 px-3 text-xs font-medium uppercase tracking-[0.13em] text-slate-500 shadow-md ring-1 ring-black/5 backdrop-blur">
          {info.stain}
        </div>
      )}

      {/* Repository logo — top-right; click opens the slide on its source site. */}
      {showChrome && logo && (
        <a
          href={slideUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open on ${logo.alt}`}
          className="absolute top-2 right-2 flex h-14 items-center rounded-lg bg-white/95 px-3.5 shadow-md ring-1 ring-black/5 backdrop-blur transition-shadow hover:shadow-lg"
        >
          <picture>
            <source srcSet={logo.avif} type="image/avif" />
            <img src={logo.png} alt={logo.alt} className="h-10 w-auto object-contain" />
          </picture>
        </a>
      )}

      {/* Magnification readout — bottom-center, out of the toolbar. */}
      {showChrome && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
          {magKnown ? "" : "~"}
          {fmtMag(currentMag)}
        </div>
      )}

      {/* Related slides panel (MGH prototype) — left edge, vertically centered. Fixed full
          height; only the WIDTH animates on hover (collapsed = a tall rail hinting "more").
          Height clears the toolbar (top) + minimap (bottom-left); list scrolls if needed. */}
      {showChrome && panelItems.length > 1 && (
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
            // labels + placeholder vs thumbnail, so a per-item constant mis-sizes it). Collapsed:
            // a tall rail sized by slide count. maxHeight caps both to the band between the
            // toolbar (top) and minimap (bottom-left); longer cases scroll within it.
            height: slidesOpen ? undefined : 44 + panelItems.length * (isFullscreen ? 140 : 104),
            maxHeight: "calc(100% - 5rem - 9rem)",
          }}
          className="absolute left-2 top-20 z-10 flex flex-col overflow-hidden rounded-lg bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur transition-all duration-200 ease-out"
        >
          {slidesOpen ? (
            <>
              <div className="flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-xs font-medium text-slate-500">
                <Layers className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Related slides</span>
                <span className="ml-auto tabular-nums text-slate-400">{panelItems.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {panelItems.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => onPickItem(s.key)}
                    className={`block w-full rounded-md p-1.5 text-left ${
                      s.active ? "bg-primary/5 ring-2 ring-primary" : "hover:bg-gray-100"
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
                          className={`w-full rounded bg-gray-50 object-contain ${
                            isFullscreen ? "h-24" : "h-16"
                          }`}
                        />
                      ) : (
                        <div
                          className={`flex w-full items-center justify-center rounded bg-gray-50 text-gray-300 ${
                            isFullscreen ? "h-24" : "h-16"
                          }`}
                        >
                          <Microscope className="h-6 w-6" />
                        </div>
                      )}
                      {s.stain && (
                        <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-[0.1em] text-slate-500 shadow-sm ring-1 ring-black/5 backdrop-blur">
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
              <span className="text-[10px] font-semibold tabular-nums">{panelItems.length}</span>
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

      {/* Rotation dial — lower-right ring (minimap is lower-left) */}
      {showChrome && <RotationDial degrees={rotation} onChange={applyRotation} />}

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

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-black/10" />;
}

// Popover anchored directly under its trigger button (parent must be `relative`).
function Popover({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
function MagSlider({
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

// Magnification display + log-scale slider mapping (1×…100×).
function fmtMag(m: number): string {
  if (m < 10) return `${m.toFixed(1)}×`;
  return `${Math.round(m)}×`;
}
const MAG_MIN = 1;
const MAG_MAX = 100;
function magToSlider(m: number): number {
  const c = Math.min(MAG_MAX, Math.max(MAG_MIN, m));
  return Math.log(c / MAG_MIN) / Math.log(MAG_MAX / MAG_MIN);
}
function sliderToMag(s: number): number {
  return MAG_MIN * Math.pow(MAG_MAX / MAG_MIN, s);
}

function AdjustRow({
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

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700">{value}</dd>
    </div>
  );
}

function BarBtn({
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
      className={`flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 ${
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
function RotationDial({ degrees, onChange }: { degrees: number; onChange: (deg: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const SIZE = 76;
  const C = SIZE / 2;
  const R = 31;

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
        <circle cx={hx} cy={hy} r="5.5" className="fill-primary" stroke="white" strokeWidth="2" />
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-700"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {Math.round(degrees)}°
        </text>
      </svg>
    </div>
  );
}
