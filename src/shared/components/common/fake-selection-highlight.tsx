"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
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

const SEARCH_SUFFIX = "pathology";
const MIN_CHARS = 2;
const VIRTUAL_SLIDES_SEARCH_PATH = "/tools/virtual-slides";

const TOP_MATCH_MIN_SCORE_WHO = 85;
// 90 = the selected phrase appears verbatim inside a real diagnosis ("contains exact phrase").
// Was 95 (exact diagnosis / WHO-acronym only), which suppressed the WSI button for basic terms
// that exist only as a substring of a longer diagnosis (e.g. "Chronic Hepatitis B" → corpus
// "Mild chronic hepatitis B and steatosis"). 90 keeps it confident without demanding an exact row.
const TOP_MATCH_MIN_SCORE_OTHER = 90;
const PATHPRESENTER_TIE_DELTA = 5;
const PATHPRESENTER_REPOSITORY = "PathPresenter";
const WHO_REPOSITORY = "WHO Blue Books Online";

// Choose which slide the inline-viewer action opens. The top WSI match is often a PathPresenter
// slide (preferred for external deep-links) our viewer can't render, so we may need a substitute.
// Priority:
//   1. The #1-ranked match if the viewer can render it — highest confidence wins, any repo.
//   2. Otherwise a WHO Blue Books slide (curated reference).
//   3. Otherwise just the highest-ranked renderable match (natural search order — no repo bias).
// Returns null when nothing among the matches is renderable (caller falls back to the link).
// topMatches is ranked (and deduped by diagnosis), so index 0 is the strongest match.
function pickViewableSlide(
  topMatch: TopMatch | null,
  topMatches: VirtualSlide[]
): VirtualSlide | null {
  if (!topMatch || topMatches.length === 0) return null;
  if (isViewerSupported(topMatches[0].repository)) return topMatches[0];
  const supported = topMatches.filter((s) => isViewerSupported(s.repository));
  if (supported.length === 0) return null;
  return supported.find((s) => s.repository === WHO_REPOSITORY) ?? supported[0];
}

function queryTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-/]/g, " ")
      .match(/[a-z0-9]+/g) || []
  );
}

function isWhoAcronymMatch(slide: VirtualSlide, queryText: string): boolean {
  if (!slide.acronym) return false;
  const acronyms = (Array.isArray(slide.acronym) ? slide.acronym : [slide.acronym]).map((a) =>
    a.toLowerCase()
  );
  const tokens = queryTokens(queryText);
  return tokens.some((t) => acronyms.includes(t));
}

function buildGoogleImagesUrl(text: string) {
  const q = `${text} ${SEARCH_SUFFIX}`.trim();
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
}

function buildVirtualSlidesUrl(text: string) {
  return `${VIRTUAL_SLIDES_SEARCH_PATH}?search=${encodeURIComponent(text)}`;
}

function openInTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
  window.getSelection()?.removeAllRanges();
}

function openGoogleImages(text: string) {
  openInTab(buildGoogleImagesUrl(text));
}

function openVirtualSlides(text: string) {
  openInTab(buildVirtualSlidesUrl(text));
}

function openWsi(url: string) {
  openInTab(url);
}

function useDelayedPresence<T>(
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

type TopMatch = { slide: VirtualSlide; score: number; isWho: boolean };

function useTopMatches(
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

function useTopWsiMatch(
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
  if (!barElement) return null;
  const barRect = barElement.getBoundingClientRect();
  const btnRect = element.getBoundingClientRect();
  const leftRel = btnRect.left - barRect.left + btnRect.width / 2;
  const topRel = btnRect.top - barRect.top;
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        top: topRel - 8,
        left: leftRel,
        transform: `translate(-50%, calc(-100% + ${shown ? 0 : -TOOLTIP_LIFT_PX}px))`,
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
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${TOOLTIP_BG}`,
          filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.08))",
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

function SearchActionsBar({
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

function ContextSelectionMenu({
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

// =============================================================================
// FakeSelectionHighlight — fake-selection container with bubble + context menu.
// =============================================================================

type LocalRect = { top: number; left: number; width: number; height: number };

type FakeSelection = {
  range: Range;
  text: string;
  rects: LocalRect[];
  granularity: Granularity;
};

// Sub-ranges of `range` covering only text that is NOT inside a [data-no-highlight]
// element (each clamped to the range bounds). This is what lets a selection span an answer
// option's diagnosis while excluding chrome like the option letter ("C") or icons — otherwise
// selecting option C's "Colonic adenocarcinoma" would query "CColonic adenocarcinoma".
function selectableSegments(range: Range): Range[] {
  const anchor =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
  if (!anchor) return [range.cloneRange()];
  const walker = document.createTreeWalker(
    (anchor as Node) ?? range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        if (!n.textContent) return NodeFilter.FILTER_REJECT;
        if (!range.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
        const el = (n as Text).parentElement;
        if (el && el.closest(NO_HIGHLIGHT_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  const segs: Range[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent ? node.textContent.length : 0;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : len;
    if (end <= start) continue;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, end);
    segs.push(r);
  }
  // Fall back to the raw range if nothing matched (e.g. selection wholly inside skip chrome).
  return segs.length ? segs : [range.cloneRange()];
}

// Selected text with [data-no-highlight] chrome (option letters, icons) removed.
function rangeCleanText(range: Range): string {
  return selectableSegments(range)
    .map((r) => r.toString())
    .join("");
}

function rangeToLocalRects(range: Range, container: HTMLElement): LocalRect[] {
  const c = container.getBoundingClientRect();
  const rects: LocalRect[] = [];
  for (const seg of selectableSegments(range)) {
    for (const r of Array.from(seg.getClientRects())) {
      if (r.width <= 0 || r.height <= 0) continue;
      rects.push({ top: r.top - c.top, left: r.left - c.left, width: r.width, height: r.height });
    }
  }
  return rects;
}

type CaretPos = { node: Node; offset: number };

function caretPosFromPoint(x: number, y: number): CaretPos | null {
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (docAny.caretPositionFromPoint) {
    const pos = docAny.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

function buildRange(anchor: CaretPos, focus: CaretPos): Range | null {
  try {
    const r = document.createRange();
    let forward: boolean;
    if (anchor.node === focus.node) {
      forward = anchor.offset <= focus.offset;
    } else {
      const cmp = anchor.node.compareDocumentPosition(focus.node);
      forward = (cmp & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    }
    if (forward) {
      r.setStart(anchor.node, anchor.offset);
      r.setEnd(focus.node, focus.offset);
    } else {
      r.setStart(focus.node, focus.offset);
      r.setEnd(anchor.node, anchor.offset);
    }
    return r;
  } catch {
    return null;
  }
}

const LONG_PRESS_MS = 350;
const LONG_PRESS_TOLERANCE_PX = 8;
const DRAG_THRESHOLD_PX = 3;
const MULTI_CLICK_MS = 350;
const MULTI_CLICK_RADIUS_PX = 12;

export const SEARCH_WORD_LIMIT = 8;
export const TOP_MATCH_MIN_SCORE_WHO_EXPORT = TOP_MATCH_MIN_SCORE_WHO;
export const TOP_MATCH_MIN_SCORE_OTHER_EXPORT = TOP_MATCH_MIN_SCORE_OTHER;

const MENU_APPEAR_DELAY_MS = 220;
const MENU_FADE_DURATION_MS = 120;
const HIGHLIGHT_COLOR = "rgba(250, 204, 21, 0.38)";

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const BLOCK_TAGS = new Set([
  "P",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "DIV",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "HEADER",
  "FOOTER",
  "NAV",
  "MAIN",
  "TD",
  "TH",
  "TR",
  "FIGCAPTION",
  "FIGURE",
  "DD",
  "DT",
  "PRE",
  "ADDRESS",
  "DETAILS",
  "SUMMARY",
]);

function getBlockAncestor(node: Node): Element | null {
  let cur: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    if (BLOCK_TAGS.has((cur as Element).tagName)) return cur as Element;
    cur = cur.parentNode;
  }
  return null;
}

function expandToWordRange(pos: CaretPos): Range | null {
  if (pos.node.nodeType !== Node.TEXT_NODE) return null;
  const wordCh = /[\p{L}\p{N}_-]/u;
  const block = getBlockAncestor(pos.node);
  const walker = block ? document.createTreeWalker(block, NodeFilter.SHOW_TEXT) : null;

  let startNode = pos.node as Text;
  let startOffset = pos.offset;
  let scanNode: Text = pos.node as Text;
  let scanOffset = pos.offset;
  for (;;) {
    const t = scanNode.data;
    while (scanOffset > 0 && wordCh.test(t[scanOffset - 1])) scanOffset--;
    startNode = scanNode;
    startOffset = scanOffset;
    if (scanOffset > 0) break;
    if (!walker) break;
    walker.currentNode = scanNode;
    const prev = walker.previousNode() as Text | null;
    if (!prev) break;
    if (prev.data.length === 0 || !wordCh.test(prev.data[prev.data.length - 1])) break;
    scanNode = prev;
    scanOffset = prev.data.length;
  }

  let endNode = pos.node as Text;
  let endOffset = pos.offset;
  scanNode = pos.node as Text;
  scanOffset = pos.offset;
  if (walker) walker.currentNode = pos.node;
  for (;;) {
    const t = scanNode.data;
    while (scanOffset < t.length && wordCh.test(t[scanOffset])) scanOffset++;
    endNode = scanNode;
    endOffset = scanOffset;
    if (scanOffset < t.length) break;
    if (!walker) break;
    walker.currentNode = scanNode;
    const next = walker.nextNode() as Text | null;
    if (!next) break;
    if (next.data.length === 0 || !wordCh.test(next.data[0])) break;
    scanNode = next;
    scanOffset = 0;
  }

  if (startNode === endNode && startOffset === endOffset) return null;
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  return r;
}

function paragraphRange(pos: CaretPos): Range | null {
  const block = getBlockAncestor(pos.node);
  if (!block) return null;
  const r = document.createRange();
  r.selectNodeContents(block);
  return r;
}

function firstTextPos(root: Node): CaretPos | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode() as Text | null;
  return node ? { node, offset: 0 } : null;
}

function lastTextPos(root: Node): CaretPos | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let n: Node | null;
  while ((n = walker.nextNode())) last = n as Text;
  return last ? { node: last, offset: last.data.length } : null;
}

function unionRanges(a: Range, b: Range): Range {
  const out = a.cloneRange();
  if (a.compareBoundaryPoints(Range.START_TO_START, b) > 0) {
    out.setStart(b.startContainer, b.startOffset);
  }
  if (a.compareBoundaryPoints(Range.END_TO_END, b) < 0) {
    out.setEnd(b.endContainer, b.endOffset);
  }
  return out;
}

type Granularity = "char" | "word" | "paragraph";

type DragState = {
  granularity: Granularity;
  anchor: CaretPos;
  anchorRange?: Range;
  downX: number;
  downY: number;
  moved: boolean;
  pointerType: string;
};

// Selector that, when matched by a pointerdown / contextmenu target, makes the
// wrapper bail out entirely so the inner element receives the event normally.
// Used by callers that nest interactive widgets (answer buttons, etc.) inside
// the selection surface — without this, the wrapper hijacks right-click for its
// context menu, breaking strike-out toggles and other inner UX.
const NO_HIGHLIGHT_SELECTOR = "[data-no-highlight]";

function targetMatchesSkip(target: EventTarget | null): boolean {
  return !!(target as HTMLElement | null)?.closest?.(NO_HIGHLIGHT_SELECTOR);
}

// Touch devices: the custom pointer-driven selection (long-press, drag, caret-from-point)
// fights native text selection and scrolling and "doesn't work well on mobile", so on
// coarse-pointer devices we skip it entirely and render children plainly — native selection
// works and the search/highlight bubble is simply unavailable there for now. A touch-friendly
// variant is a TODO. Gating here (rather than at each call site) disables it everywhere at once.
function useCoarsePointer(): boolean {
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

type FakeSelectionHighlightProps = {
  allSlides: VirtualSlide[] | null;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // When provided, the WSI match action opens the slide in the in-house viewer (inline)
  // instead of linking out — for repos the viewer can render. The host renders the modal.
  onViewSlide?: (slide: VirtualSlide) => void;
};

export function FakeSelectionHighlight(props: FakeSelectionHighlightProps) {
  const coarsePointer = useCoarsePointer();
  if (coarsePointer) {
    return (
      <div className={props.className} style={props.style}>
        {props.children}
      </div>
    );
  }
  return <FakeSelectionHighlightImpl {...props} />;
}

function FakeSelectionHighlightImpl({
  allSlides,
  children,
  className,
  style,
  onViewSlide,
}: FakeSelectionHighlightProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<FakeSelection | null>(null);
  const selectionRef = useRef<FakeSelection | null>(null);
  selectionRef.current = selection;
  const [active, setActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [highlights, setHighlights] = useState<
    Array<{ id: number; range: Range; text: string; rects: LocalRect[] }>
  >([]);
  const highlightIdRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const longPressRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRangeRef = useRef<{ range: Range; granularity: Granularity } | null>(null);
  const clickStreakRef = useRef<{ count: number; time: number; x: number; y: number } | null>(null);
  const { current: stableSelection, visible: menuVisible } = useDelayedPresence(
    selection,
    MENU_APPEAR_DELAY_MS,
    MENU_FADE_DURATION_MS
  );
  const queryText = selection?.text ?? stableSelection?.text;
  const topMatch = useTopWsiMatch(queryText, allSlides);
  const topMatches = useTopMatches(queryText, allSlides, 8);

  const toggleHighlight = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    setHighlights((prev) => {
      const overlapIds = new Set<number>();
      for (const h of prev) {
        const aEndVsBStart = sel.range.compareBoundaryPoints(Range.START_TO_END, h.range);
        const aStartVsBEnd = sel.range.compareBoundaryPoints(Range.END_TO_START, h.range);
        if (aEndVsBStart > 0 && aStartVsBEnd < 0) overlapIds.add(h.id);
      }
      if (overlapIds.size > 0) {
        return prev.filter((h) => !overlapIds.has(h.id));
      }
      const id = ++highlightIdRef.current;
      return [
        ...prev,
        { id, range: sel.range.cloneRange(), text: sel.text, rects: [...sel.rects] },
      ];
    });
  }, []);

  const commitRange = useCallback((range: Range, granularity: Granularity) => {
    const text = rangeCleanText(range).replace(/\s+/g, " ").trim();
    if (text.length < MIN_CHARS) {
      setSelection(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rects = rangeToLocalRects(range, container);
    if (rects.length === 0) {
      setSelection(null);
      return;
    }
    setSelection({ range, text, rects, granularity });
  }, []);

  const clearSelection = useCallback(() => {
    dragRef.current = null;
    setSelection(null);
    setActive(false);
    setContextMenu(null);
  }, []);

  const cancelLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const isInsideMenu = (node: EventTarget | null) =>
    !!(node as HTMLElement)?.closest?.("[data-fake-selection-menu], [data-context-menu]");

  const tickClickStreak = (e: React.PointerEvent): number => {
    const prev = clickStreakRef.current;
    const now = Date.now();
    const continuation =
      prev != null &&
      now - prev.time <= MULTI_CLICK_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= MULTI_CLICK_RADIUS_PX;
    const count = continuation ? Math.min(prev!.count + 1, 3) : 1;
    clickStreakRef.current = { count, time: now, x: e.clientX, y: e.clientY };
    return count;
  };

  const extendSelectionToPos = (pos: CaretPos): Range | null => {
    const cur = selectionRef.current;
    if (!cur) return null;
    const cmp = cur.range.comparePoint(pos.node, pos.offset);
    if (cur.granularity === "word") {
      const focusWord = expandToWordRange(pos);
      return focusWord ? unionRanges(cur.range, focusWord) : cur.range.cloneRange();
    }
    if (cur.granularity === "paragraph") {
      const focusPara = paragraphRange(pos);
      return focusPara ? unionRanges(cur.range, focusPara) : cur.range.cloneRange();
    }
    const next = cur.range.cloneRange();
    if (cmp < 0) next.setStart(pos.node, pos.offset);
    else next.setEnd(pos.node, pos.offset);
    return next;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInsideMenu(e.target)) return;
    if (targetMatchesSkip(e.target)) return;
    const isContextMouse = e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey);
    if (isContextMouse) return;
    const pos = caretPosFromPoint(e.clientX, e.clientY);
    if (!pos || !containerRef.current?.contains(pos.node)) {
      clearSelection();
      return;
    }

    setContextMenu(null);

    if (e.shiftKey && selectionRef.current) {
      const next = extendSelectionToPos(pos);
      if (next) commitRange(next, selectionRef.current.granularity);
      return;
    }

    const clickCount = tickClickStreak(e);

    if (clickCount >= 3) {
      const paraRange = paragraphRange(pos);
      if (paraRange) {
        commitRange(paraRange, "paragraph");
        dragRef.current = {
          granularity: "paragraph",
          anchor: pos,
          anchorRange: paraRange,
          downX: e.clientX,
          downY: e.clientY,
          moved: false,
          pointerType: e.pointerType,
        };
        setActive(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    if (clickCount === 2) {
      const wordRange = expandToWordRange(pos);
      if (wordRange) {
        commitRange(wordRange, "word");
        dragRef.current = {
          granularity: "word",
          anchor: pos,
          anchorRange: wordRange,
          downX: e.clientX,
          downY: e.clientY,
          moved: false,
          pointerType: e.pointerType,
        };
        setActive(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    setSelection(null);
    dragRef.current = {
      granularity: "char",
      anchor: pos,
      downX: e.clientX,
      downY: e.clientY,
      moved: false,
      pointerType: e.pointerType,
    };

    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      setActive(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    } else {
      cancelLongPress();
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        if (!dragRef.current) return;
        setActive(true);
        navigator.vibrate?.(8);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }, LONG_PRESS_MS);
    }
  };

  const resolvePos = (clientX: number, clientY: number): CaretPos | null => {
    const container = containerRef.current;
    if (!container) return null;
    const pos = caretPosFromPoint(clientX, clientY);
    if (pos && container.contains(pos.node)) return pos;
    const cRect = container.getBoundingClientRect();
    if (clientY < cRect.top) return firstTextPos(container);
    if (clientY > cRect.bottom) return lastTextPos(container);
    const clampedX = Math.max(cRect.left + 1, Math.min(cRect.right - 1, clientX));
    if (clampedX !== clientX) {
      const fallback = caretPosFromPoint(clampedX, clientY);
      if (fallback && container.contains(fallback.node)) return fallback;
    }
    return null;
  };

  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  const commitFromPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = resolvePos(clientX, clientY);
    if (!pos) return;
    let range: Range | null;
    if (drag.granularity === "word" && drag.anchorRange) {
      const focusWord = expandToWordRange(pos);
      range = focusWord ? unionRanges(drag.anchorRange, focusWord) : drag.anchorRange;
    } else if (drag.granularity === "paragraph" && drag.anchorRange) {
      const focusPara = paragraphRange(pos);
      range = focusPara ? unionRanges(drag.anchorRange, focusPara) : drag.anchorRange;
    } else {
      range = buildRange(drag.anchor, pos);
    }
    if (!range) return;
    pendingRangeRef.current = { range, granularity: drag.granularity };
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRangeRef.current;
      pendingRangeRef.current = null;
      if (pending) commitRange(pending.range, pending.granularity);
    });
  };

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current != null) {
      window.cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  };

  const ensureAutoScroll = (dir: -1 | 1, speedPx: number) => {
    if (autoScrollRafRef.current != null) return;
    const tick = () => {
      const drag = dragRef.current;
      const lp = lastPointerRef.current;
      if (!drag || !lp) {
        autoScrollRafRef.current = null;
        return;
      }
      window.scrollBy(0, dir * speedPx);
      commitFromPointer(lp.x, lp.y);
      autoScrollRafRef.current = window.requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = window.requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.downX;
    const dy = e.clientY - drag.downY;
    const dist = Math.hypot(dx, dy);

    if (drag.pointerType === "touch" && !active) {
      if (dist > LONG_PRESS_TOLERANCE_PX) {
        cancelLongPress();
        dragRef.current = null;
      }
      return;
    }

    if (!active) return;

    if (!drag.moved && dist < DRAG_THRESHOLD_PX) return;
    drag.moved = true;

    if (e.pointerType !== "mouse") e.preventDefault();

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    commitFromPointer(e.clientX, e.clientY);

    const EDGE = 60;
    const vh = window.innerHeight;
    if (e.clientY < EDGE) {
      const speed = Math.min(20, 4 + (EDGE - e.clientY) * 0.3);
      ensureAutoScroll(-1, speed);
    } else if (e.clientY > vh - EDGE) {
      const speed = Math.min(20, 4 + (e.clientY - (vh - EDGE)) * 0.3);
      ensureAutoScroll(1, speed);
    } else {
      stopAutoScroll();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelLongPress();
    stopAutoScroll();
    lastPointerRef.current = null;
    const drag = dragRef.current;
    if (drag) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (!drag.moved && !selection && drag.granularity === "char") {
        setActive(false);
      }
    }
    dragRef.current = null;
  };

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerType !== "mouse") return;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      commitFromPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (dragRef.current?.pointerType !== "mouse") return;
      cancelLongPress();
      stopAutoScroll();
      lastPointerRef.current = null;
      dragRef.current = null;
      setActive(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!selection) return;
    const onCopy = (e: ClipboardEvent) => {
      e.clipboardData?.setData("text/plain", selection.text);
      e.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [selection]);

  useEffect(() => {
    if (!stableSelection) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        return;
      }

      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd || !e.shiftKey || e.altKey) return;

      const text = stableSelection.text;
      const wsiUrl = topMatch?.slide.case_url || topMatch?.slide.slide_url || "";
      const allowSearch = countWords(text) <= SEARCH_WORD_LIMIT;
      const key = e.key.toLowerCase();

      if (key === "g" && allowSearch) {
        e.preventDefault();
        openGoogleImages(text);
        clearSelection();
        return;
      }
      if (key === "v" && allowSearch) {
        e.preventDefault();
        openVirtualSlides(text);
        clearSelection();
        return;
      }
      if (key === "w" && allowSearch && wsiUrl) {
        e.preventDefault();
        openWsi(wsiUrl);
        clearSelection();
        return;
      }
      if (key === "h") {
        e.preventDefault();
        toggleHighlight();
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stableSelection, topMatch, clearSelection, toggleHighlight]);

  useEffect(() => {
    if (!selection) return;
    const onDocDown = (e: MouseEvent) => {
      if (isInsideMenu(e.target)) return;
      if (!containerRef.current?.contains(e.target as Node)) {
        clearSelection();
      }
    };
    window.addEventListener("mousedown", onDocDown);
    return () => window.removeEventListener("mousedown", onDocDown);
  }, [selection, clearSelection]);

  useEffect(() => {
    if (!selection && highlights.length === 0) return;
    const update = () => {
      const container = containerRef.current;
      if (!container) return;
      if (selectionRef.current) {
        const rects = rangeToLocalRects(selectionRef.current.range, container);
        if (rects.length === 0) clearSelection();
        else setSelection((cur) => (cur ? { ...cur, rects } : cur));
      }
      setHighlights((prev) =>
        prev.length === 0
          ? prev
          : prev.map((h) => ({ ...h, rects: rangeToLocalRects(h.range, container) }))
      );
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selection, highlights.length, clearSelection]);

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInsideMenu(e.target)) {
      e.preventDefault();
      return;
    }
    if (targetMatchesSkip(e.target)) return;
    e.preventDefault();
    const pos = caretPosFromPoint(e.clientX, e.clientY);
    if (!pos || !containerRef.current?.contains(pos.node)) return;
    if (!selectionRef.current) {
      const word = expandToWordRange(pos);
      if (word) commitRange(word, "word");
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-context-menu]")) return;
      setContextMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [contextMenu]);

  const menuRects = selection?.rects ?? stableSelection?.rects;
  const menuStyle: React.CSSProperties | undefined =
    stableSelection && menuRects && menuRects.length > 0
      ? (() => {
          const first = menuRects[0];
          return {
            position: "absolute" as const,
            top: first.top - 8,
            left: first.left + first.width / 2,
            transform: "translate(-50%, -100%)",
          };
        })()
      : undefined;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        cursor: "text",
        position: "relative",
        touchAction: active ? "none" : "pan-y",
      }}
    >
      {/* Content layer carries the caller's spacing/styling. The overlays below are positioned
          against this relative root but kept OUT of the content's flow, so a live selection's
          rects/menu can never nudge the card's height (the reported "grows a few px" glitch). */}
      <div className={className} style={style}>
        {children}
      </div>
      {highlights.map((h) =>
        h.rects.map((rect, i) => (
          <div
            key={`${h.id}-${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              background: HIGHLIGHT_COLOR,
              pointerEvents: "none",
              zIndex: 40,
              borderRadius: 2,
            }}
          />
        ))
      )}
      {selection &&
        selection.rects.map((rect, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="fake-selection-rect"
            style={{
              position: "absolute",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              background: "rgba(99, 102, 241, 0.18)",
              pointerEvents: "none",
              zIndex: 30,
              borderRadius: 2,
            }}
          />
        ))}
      {stableSelection && menuStyle && (
        <div
          data-fake-selection-menu
          style={{
            ...menuStyle,
            opacity: contextMenu ? 0 : menuVisible ? 1 : 0,
            pointerEvents: contextMenu ? "none" : "auto",
            transition: `opacity ${MENU_FADE_DURATION_MS}ms ease-out`,
            zIndex: 50,
          }}
        >
          <SearchActionsBar
            text={stableSelection.text}
            topMatch={topMatch}
            topMatches={topMatches}
            onHighlight={toggleHighlight}
            onDismiss={clearSelection}
            onViewSlide={onViewSlide}
          />
        </div>
      )}
      {contextMenu && selection && (
        <ContextSelectionMenu
          x={contextMenu.x}
          y={contextMenu.y}
          text={selection.text}
          topMatch={topMatch}
          topMatches={topMatches}
          onHighlight={() => {
            toggleHighlight();
            setContextMenu(null);
          }}
          onViewSlide={
            onViewSlide
              ? (slide) => {
                  onViewSlide(slide);
                  setContextMenu(null);
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}
      <style jsx>{`
        .fake-selection-rect {
          animation: fake-selection-fade-in 90ms ease-out;
        }
        @keyframes fake-selection-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
