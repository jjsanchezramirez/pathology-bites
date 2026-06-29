"use client";

// Presentational sub-components + data hooks for the fake-selection-highlight tool:
// the slide-match data hooks, the shared tooltip, the bubble toolbar (SearchActionsBar)
// + its dropdown, and the right-click ContextSelectionMenu. All prop-driven — the
// selection/pointer engine stays in fake-selection-highlight.tsx.

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  ImageIcon,
  Copy,
  Check,
  Microscope,
  Search,
  Highlighter,
  ExternalLink,
  Eye,
} from "lucide-react";
import { rankSlidesWithExpansion } from "@/shared/utils/domain/virtual-slide-search";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import {
  SEARCH_WORD_LIMIT,
  TOP_MATCH_MIN_SCORE_WHO,
  TOP_MATCH_MIN_SCORE_OTHER,
  PATHPRESENTER_TIE_DELTA,
  PATHPRESENTER_REPOSITORY,
  type TopMatch,
  pickViewableSlide,
  isWhoAcronymMatch,
  openGoogleImages,
  openVirtualSlides,
  openWsi,
} from "./fake-selection-highlight-utils";
import { countWords } from "./fake-selection-highlight-dom";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useDelayedPresence<T>(
  value: T | null,
  appearDelay: number,
  fadeDurationMs: number
): { current: T | null; visible: boolean } {
  const [current, setCurrent] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  const appearTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (appearTimerRef.current != null) {
        window.clearTimeout(appearTimerRef.current);
        appearTimerRef.current = null;
      }
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    clearTimers();

    if (value != null) {
      appearTimerRef.current = window.setTimeout(() => {
        appearTimerRef.current = null;
        setCurrent(value);
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          setVisible(true);
        });
      }, appearDelay);
    } else {
      setVisible(false);
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null;
        setCurrent(null);
      }, fadeDurationMs);
    }

    return clearTimers;
  }, [value, appearDelay, fadeDurationMs]);

  return { current, visible };
}

export function useTopMatches(
  text: string | undefined,
  allSlides: VirtualSlide[] | null,
  n = 10
): VirtualSlide[] {
  const [matches, setMatches] = useState<VirtualSlide[]>([]);
  useEffect(() => {
    let mounted = true;
    if (!text || !allSlides || allSlides.length === 0) {
      setMatches([]);
      return;
    }
    rankSlidesWithExpansion(allSlides, text)
      .then(({ slides }) => {
        if (!mounted) return;
        const seen = new Set<string>();
        const out: VirtualSlide[] = [];
        for (const s of slides) {
          const key = (s.diagnosis || "").toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(s);
          if (out.length >= n) break;
        }
        setMatches(out);
      })
      .catch(() => {
        if (mounted) setMatches([]);
      });
    return () => {
      mounted = false;
    };
  }, [text, allSlides, n]);
  return matches;
}

export function useTopWsiMatch(
  text: string | undefined,
  allSlides: VirtualSlide[] | null
): TopMatch | null {
  const [top, setTop] = useState<TopMatch | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!text || !allSlides || allSlides.length === 0) {
      setTop(null);
      return;
    }
    rankSlidesWithExpansion(allSlides, text)
      .then(({ scoredSlides, topScore }) => {
        if (!mounted) return;
        if (!scoredSlides || scoredSlides.length === 0 || topScore == null) {
          setTop(null);
          return;
        }

        const topSlide = scoredSlides[0].slide;
        const topIsWho = isWhoAcronymMatch(topSlide, text);
        const minScore = topIsWho ? TOP_MATCH_MIN_SCORE_WHO : TOP_MATCH_MIN_SCORE_OTHER;
        if (topScore < minScore) {
          setTop(null);
          return;
        }

        const topDiagnosisLower = (topSlide.diagnosis || "").toLowerCase();
        const tierFloor = topScore - PATHPRESENTER_TIE_DELTA;
        const pathPresenterPick = scoredSlides.find(
          ({ slide, score }) =>
            score >= tierFloor &&
            slide.repository === PATHPRESENTER_REPOSITORY &&
            (slide.diagnosis || "").toLowerCase() === topDiagnosisLower
        );

        const chosen = pathPresenterPick ?? scoredSlides[0];
        const isWho = isWhoAcronymMatch(chosen.slide, text);
        setTop({ slide: chosen.slide, score: chosen.score, isWho });
      })
      .catch(() => {
        if (mounted) setTop(null);
      });
    return () => {
      mounted = false;
    };
  }, [text, allSlides]);

  return top;
}

// =============================================================================
// Bubble menu — Editor.js-inspired toolbar that pops near a text selection.
// =============================================================================

const TOOLTIP_OPEN_DELAY_MS = 180;
const TOOLTIP_CLOSE_DELAY_MS = 80;
const TOOLTIP_FADE_MS = 110;
const TOOLTIP_LIFT_PX = 4;
const TOOLTIP_GAP_PX = 8;
// The fixed site navbar (z-50, same as the bubble menu) owns the top of the viewport;
// anything opening upward into that band slides UNDER it and gets cut off. When there
// isn't this much clearance above, the tooltip / bubble bar flips downward instead.
export const VIEWPORT_TOP_SAFE_PX = 72;
const TOOLTIP_BG = "#0f172a";
const TOOLTIP_FG = "#ffffff";
const TOOLTIP_FG_DIM = "#cbd5e1";

type TooltipContent = {
  label: string;
  shortcut?: string;
  description?: string;
  badge?: string;
};

type TooltipController = {
  showFor: (element: HTMLElement, content: TooltipContent) => void;
  hide: () => void;
};

const TooltipControllerCtx = createContext<TooltipController | null>(null);

function SharedTooltip({
  active,
  shown,
  barElement,
}: {
  active: { element: HTMLElement; content: TooltipContent };
  shown: boolean;
  barElement: HTMLElement | null;
}) {
  const { element, content } = active;
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [flipBelow, setFlipBelow] = useState(false);

  // Measure after render (before paint) so the flip accounts for the real tooltip
  // height, including the optional description line.
  useLayoutEffect(() => {
    const tipHeight = tipRef.current?.offsetHeight ?? 0;
    const btnTop = element.getBoundingClientRect().top;
    setFlipBelow(btnTop - TOOLTIP_GAP_PX - tipHeight < VIEWPORT_TOP_SAFE_PX);
  }, [element, content]);

  if (!barElement) return null;
  const barRect = barElement.getBoundingClientRect();
  const btnRect = element.getBoundingClientRect();
  const leftRel = btnRect.left - barRect.left + btnRect.width / 2;
  const topRel = btnRect.top - barRect.top;
  const lift = shown ? 0 : flipBelow ? TOOLTIP_LIFT_PX : -TOOLTIP_LIFT_PX;
  return (
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: "absolute",
        top: flipBelow ? topRel + btnRect.height + TOOLTIP_GAP_PX : topRel - TOOLTIP_GAP_PX,
        left: leftRel,
        transform: flipBelow
          ? `translate(-50%, ${lift}px)`
          : `translate(-50%, calc(-100% + ${lift}px))`,
        opacity: shown ? 1 : 0,
        transition: `opacity ${TOOLTIP_FADE_MS}ms ease-out, transform ${TOOLTIP_FADE_MS}ms ease-out`,
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      <span
        style={{
          display: "block",
          background: TOOLTIP_BG,
          color: TOOLTIP_FG,
          borderRadius: 8,
          padding: "6px 10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          maxWidth: 240,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ whiteSpace: "nowrap" }}>{content.label}</span>
          {content.shortcut && (
            <span
              style={{
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.5px",
                color: TOOLTIP_FG_DIM,
                background: "rgba(255,255,255,0.08)",
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                lineHeight: 1,
              }}
            >
              {content.shortcut}
            </span>
          )}
        </span>
        {content.description && (
          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.35,
              color: TOOLTIP_FG_DIM,
            }}
          >
            {content.description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          ...(flipBelow ? { bottom: "100%" } : { top: "100%" }),
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          ...(flipBelow
            ? { borderBottom: `5px solid ${TOOLTIP_BG}` }
            : { borderTop: `5px solid ${TOOLTIP_BG}` }),
          filter: flipBelow ? undefined : "drop-shadow(0 2px 2px rgba(0,0,0,0.08))",
        }}
      />
    </div>
  );
}

function useSharedTooltip() {
  const [active, setActive] = useState<{ element: HTMLElement; content: TooltipContent } | null>(
    null
  );
  const [shown, setShown] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const shownRef = useRef(false);
  shownRef.current = shown;

  const cancelOpen = () => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const cancelClose = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (unmountTimerRef.current != null) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  };

  const showFor = useCallback((element: HTMLElement, content: TooltipContent) => {
    cancelClose();
    setActive({ element, content });
    if (shownRef.current) {
      return;
    }
    cancelOpen();
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setShown(true);
      });
    }, TOOLTIP_OPEN_DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    cancelOpen();
    if (!shownRef.current) {
      setActive(null);
      return;
    }
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setShown(false);
      unmountTimerRef.current = window.setTimeout(() => {
        unmountTimerRef.current = null;
        setActive(null);
      }, TOOLTIP_FADE_MS);
    }, TOOLTIP_CLOSE_DELAY_MS);
  }, []);

  useEffect(
    () => () => {
      cancelOpen();
      cancelClose();
    },
    []
  );

  const controller = useMemo<TooltipController>(() => ({ showFor, hide }), [showFor, hide]);

  return { active, shown, controller };
}

type AccentKey = "amber" | "emerald" | "blue";

const ACCENT_COLORS: Record<AccentKey, { bg: string; fg: string }> = {
  amber: { bg: "#fef3c7", fg: "#a16207" },
  emerald: { bg: "#d1fae5", fg: "#047857" },
  blue: { bg: "#dbeafe", fg: "#1d4ed8" },
};
const FLASH_MS = 220;

function BubbleButton({
  icon: Icon,
  label,
  description,
  shortcut,
  badge,
  accent,
  onClick,
  disabled,
}: {
  icon: typeof ImageIcon;
  label: string;
  description?: string;
  shortcut?: string;
  badge?: string;
  accent?: AccentKey;
  onClick: () => void;
  disabled?: boolean;
}) {
  const ctrl = useContext(TooltipControllerCtx);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  const handleEnter = () => {
    if (!ctrl || !buttonRef.current) return;
    ctrl.showFor(buttonRef.current, { label, shortcut, description, badge });
  };
  const handleLeave = () => ctrl?.hide();

  useEffect(
    () => () => {
      if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    },
    []
  );

  const flashColors = flash && accent ? ACCENT_COLORS[accent] : null;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={(e) => {
        ctrl?.hide();
        if (accent) {
          setFlash(true);
          if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
          flashTimerRef.current = window.setTimeout(() => {
            flashTimerRef.current = null;
            setFlash(false);
          }, FLASH_MS);
        }
        onClick();
        (e.currentTarget as HTMLButtonElement).blur();
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      disabled={disabled}
      aria-label={label}
      style={
        flashColors
          ? {
              background: flashColors.bg,
              color: flashColors.fg,
              transition: `background-color ${FLASH_MS}ms ease-out, color ${FLASH_MS}ms ease-out`,
            }
          : {
              transition: `background-color ${FLASH_MS}ms ease-out, color ${FLASH_MS}ms ease-out`,
            }
      }
      className={`relative inline-flex h-7 w-7 items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40 ${
        disabled ? "text-slate-400" : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {badge && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-blue-500 px-1 text-[7px] font-bold leading-[1.5] text-white shadow-sm"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function SearchActionsBar({
  text,
  topMatch,
  topMatches,
  enabled = true,
  onHighlight,
  onDismiss,
  onViewSlide,
  className = "",
  style,
}: {
  text: string;
  topMatch: TopMatch | null;
  topMatches: VirtualSlide[];
  enabled?: boolean;
  onHighlight?: () => void;
  onDismiss?: () => void;
  // When set, the WSI action opens the matched slide in the in-house viewer (inline, no
  // page leave) instead of the external link — but only for repos the viewer can render.
  onViewSlide?: (slide: VirtualSlide) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const wsiUrl = topMatch?.slide.case_url || topMatch?.slide.slide_url || "";
  const showWsi = enabled && !!wsiUrl && !!topMatch?.slide.diagnosis;
  // Renderable slide for the inline viewer (null → fall back to the external link).
  const viewable = onViewSlide ? pickViewableSlide(topMatch, topMatches) : null;
  const wordCount = countWords(text);
  const showSearchActions = enabled && wordCount > 0 && wordCount <= SEARCH_WORD_LIMIT;

  const onCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore
    }
  };

  const { active: tooltipActive, shown: tooltipShown, controller } = useSharedTooltip();
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-search-dropdown]")) return;
      if (t?.closest?.('[aria-label="Virtual Slide Search"]')) return;
      setSearchOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [searchOpen]);

  useEffect(() => {
    setSearchOpen(false);
  }, [text]);

  return (
    <TooltipControllerCtx.Provider value={controller}>
      <div
        ref={barRef}
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        style={{
          ...style,
          position: "relative",
          boxShadow:
            "0 0 0 1px rgba(15, 23, 42, 0.06), 0 14px 32px -8px rgba(15, 23, 42, 0.22), 0 4px 10px -2px rgba(15, 23, 42, 0.10)",
        }}
        className={`z-50 inline-flex items-center gap-0.5 rounded-lg bg-white p-0.5 ${className}`}
      >
        {tooltipActive && (
          <SharedTooltip active={tooltipActive} shown={tooltipShown} barElement={barRef.current} />
        )}
        {showSearchActions && (
          <>
            <BubbleButton
              icon={ImageIcon}
              label="Google Image Search"
              shortcut="⌘⬆G"
              accent="blue"
              onClick={() => {
                openGoogleImages(text);
                onDismiss?.();
              }}
            />
            <BubbleButton
              icon={Search}
              label="Virtual Slide Search"
              shortcut="⌘⬆V"
              accent="blue"
              onClick={() => setSearchOpen((v) => !v)}
            />
            {showWsi && (
              <BubbleButton
                icon={Microscope}
                label={viewable ? "View Whole Slide Image" : "Whole Slide Image"}
                shortcut="⌘⬆W"
                accent="blue"
                onClick={() => {
                  if (viewable) onViewSlide!(viewable);
                  else openWsi(wsiUrl);
                  onDismiss?.();
                }}
              />
            )}
            <span
              aria-hidden="true"
              style={{
                display: "block",
                width: 1,
                height: 16,
                margin: "0 4px",
                background: "rgba(15, 23, 42, 0.12)",
                flexShrink: 0,
              }}
            />
          </>
        )}
        {onHighlight && (
          <BubbleButton
            icon={Highlighter}
            label="Highlight"
            shortcut="⌘⬆H"
            accent="amber"
            onClick={onHighlight}
            disabled={!enabled || !text}
          />
        )}
        <BubbleButton
          icon={copied ? Check : Copy}
          label={copied ? "Copied" : "Copy"}
          shortcut={copied ? undefined : "⌘C"}
          accent="emerald"
          onClick={onCopy}
          disabled={!enabled || !text}
        />
        {searchOpen && (
          <SearchDropdown
            barElement={barRef.current}
            text={text}
            matches={topMatches}
            inlineViewer={!!onViewSlide}
            onPick={(slide) => {
              if (onViewSlide && isViewerSupported(slide.repository)) {
                onViewSlide(slide);
              } else {
                const url = slide.case_url || slide.slide_url || "";
                if (url) openWsi(url);
              }
              setSearchOpen(false);
              onDismiss?.();
            }}
            onSeeAll={() => {
              openVirtualSlides(text);
              setSearchOpen(false);
              onDismiss?.();
            }}
          />
        )}
      </div>
    </TooltipControllerCtx.Provider>
  );
}

function SearchDropdown({
  barElement,
  text,
  matches,
  inlineViewer = false,
  onPick,
  onSeeAll,
}: {
  barElement: HTMLElement | null;
  text: string;
  matches: VirtualSlide[];
  // When true, rows whose repo the viewer can render open in-house (eye icon) rather than
  // linking out (external-link icon).
  inlineViewer?: boolean;
  onPick: (slide: VirtualSlide) => void;
  onSeeAll: () => void;
}) {
  if (!barElement) return null;
  const trigger = barElement.querySelector(
    '[aria-label="Virtual Slide Search"]'
  ) as HTMLElement | null;
  const barRect = barElement.getBoundingClientRect();
  const trgRect = trigger?.getBoundingClientRect();
  const left = trgRect ? trgRect.left - barRect.left : 0;
  const top = barRect.height + 8;

  return (
    <div
      data-search-dropdown
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "absolute",
        top,
        left,
        zIndex: 55,
        width: 290,
        background: "white",
        borderRadius: 10,
        padding: 3,
        boxShadow:
          "0 0 0 1px rgba(15, 23, 42, 0.06), 0 14px 32px -8px rgba(15, 23, 42, 0.22), 0 4px 10px -2px rgba(15, 23, 42, 0.10)",
      }}
    >
      <div
        className="truncate"
        style={{
          padding: "4px 8px 3px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#64748b",
        }}
      >
        {matches.length > 0 ? `Top matches for "${text}"` : "No matches"}
      </div>
      {matches.map((slide) => {
        const url = slide.case_url || slide.slide_url || "";
        const opensInline = inlineViewer && isViewerSupported(slide.repository);
        const disabled = !url && !opensInline;
        const cleanDx = (slide.diagnosis || "").replace(/<[^>]+>/g, "").trim();
        return (
          <button
            key={slide.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(slide)}
            onContextMenu={(e) => e.preventDefault()}
            className="group/row flex w-full items-start gap-2 rounded text-left hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ padding: "5px 8px" }}
          >
            <span
              className="flex min-w-0 flex-1 flex-col items-start"
              style={{ gap: 1, textAlign: "left" }}
            >
              <span
                className="block w-full truncate"
                style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: "#1e293b" }}
              >
                {cleanDx || "(no diagnosis)"}
              </span>
              {slide.repository && (
                <span
                  className="block w-full truncate"
                  style={{ fontSize: 10, fontWeight: 400, lineHeight: 1.3, color: "#94a3b8" }}
                >
                  {slide.repository}
                </span>
              )}
            </span>
            {opensInline ? (
              <Eye
                className="shrink-0 text-slate-300 group-hover/row:text-blue-600"
                style={{ width: 12, height: 12, marginTop: 2 }}
                strokeWidth={2.25}
              />
            ) : (
              <ExternalLink
                className="shrink-0 text-slate-300 group-hover/row:text-slate-500"
                style={{ width: 11, height: 11, marginTop: 2 }}
                strokeWidth={2.25}
              />
            )}
          </button>
        );
      })}
      {matches.length > 0 && (
        <div
          aria-hidden="true"
          style={{ height: 1, margin: "3px 0", background: "rgba(15,23,42,0.08)" }}
        />
      )}
      <button
        type="button"
        onClick={onSeeAll}
        className="flex w-full items-center justify-between gap-2 rounded text-left text-blue-700 hover:bg-blue-50 active:bg-blue-100"
        style={{ padding: "5px 8px", fontSize: 11, fontWeight: 500 }}
      >
        <span>See all in Virtual Slide Search</span>
        <ExternalLink style={{ width: 11, height: 11 }} strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function ContextSelectionMenu({
  x,
  y,
  text,
  topMatch,
  topMatches,
  onHighlight,
  onViewSlide,
  onClose,
}: {
  x: number;
  y: number;
  text: string;
  topMatch: TopMatch | null;
  topMatches: VirtualSlide[];
  onHighlight: () => void;
  onViewSlide?: (slide: VirtualSlide) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const wsiUrl = topMatch?.slide.case_url || topMatch?.slide.slide_url || "";
  const showWsi = !!wsiUrl && !!topMatch?.slide.diagnosis;
  const viewable = onViewSlide ? pickViewableSlide(topMatch, topMatches) : null;
  const wordCount = countWords(text);
  const showSearch = wordCount > 0 && wordCount <= SEARCH_WORD_LIMIT;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => onClose(), 600);
    } catch {
      onClose();
    }
  };

  const itemBase =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-context-menu
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: y,
        left: x,
        zIndex: 70,
        background: "white",
        borderRadius: 10,
        padding: 4,
        minWidth: 200,
        boxShadow:
          "0 0 0 1px rgba(15, 23, 42, 0.06), 0 14px 32px -8px rgba(15, 23, 42, 0.22), 0 4px 10px -2px rgba(15, 23, 42, 0.10)",
      }}
    >
      {showSearch && (
        <>
          <button
            type="button"
            className={itemBase}
            onClick={() => {
              openGoogleImages(text);
              onClose();
            }}
          >
            <ImageIcon className="h-4 w-4 text-slate-500" strokeWidth={2} />
            Google Image Search
          </button>
          <button
            type="button"
            className={itemBase}
            onClick={() => {
              openVirtualSlides(text);
              onClose();
            }}
          >
            <Search className="h-4 w-4 text-slate-500" strokeWidth={2} />
            Virtual Slide Search
          </button>
          {showWsi && (
            <button
              type="button"
              className={itemBase}
              onClick={() => {
                if (viewable) onViewSlide!(viewable);
                else openWsi(wsiUrl);
                onClose();
              }}
            >
              {viewable ? (
                <Eye className="h-4 w-4 text-slate-500" strokeWidth={2} />
              ) : (
                <Microscope className="h-4 w-4 text-slate-500" strokeWidth={2} />
              )}
              <span className="flex flex-1 items-center gap-1.5">
                {viewable ? "View Whole Slide Image" : "Whole Slide Image"}
              </span>
            </button>
          )}
          <div
            aria-hidden="true"
            style={{ height: 1, margin: "4px 0", background: "rgba(15,23,42,0.08)" }}
          />
        </>
      )}
      <button type="button" className={itemBase} onClick={onHighlight}>
        <Highlighter className="h-4 w-4 text-slate-500" strokeWidth={2} />
        Highlight
      </button>
      <button type="button" className={itemBase} onClick={onCopy}>
        {copied ? (
          <Check className="h-4 w-4 text-green-600" strokeWidth={2} />
        ) : (
          <Copy className="h-4 w-4 text-slate-500" strokeWidth={2} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>,
    document.body
  );
}

// Touch devices: the custom pointer-driven selection (long-press, drag, caret-from-point)
// fights native text selection and scrolling and "doesn't work well on mobile", so on
// coarse-pointer devices we skip it entirely and render children plainly — native selection
// works and the search/highlight bubble is simply unavailable there for now. A touch-friendly
// variant is a TODO. Gating here (rather than at each call site) disables it everywhere at once.
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}
