"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import { DrAlbrightFigure } from "./dr-albright-figure";

export type AlbrightMood = "idle" | "thinking" | "done";

/**
 * Lines Dr. Albright says. Short and dry on purpose — whimsy wears thin fast.
 * Thinking lines are status; idle and done lines come and go on a timer.
 */
const QUIPS = {
  idle: [
    "Got a differential?",
    "Ask me about a stain.",
    "WHO, PubMed or PathologyOutlines. I read all three.",
    "No question too basic.",
    "Stuck on an IHC panel?",
  ],
  thinking: [
    "Checking PathologyOutlines…",
    "Consulting the WHO…",
    "Searching PubMed…",
    "Reading the stains…",
  ],
  done: ["Here's what the sources say.", "A classic.", "Worth a look at the panel."],
} as const;

/** Bubble timing: on screen, then gone, then (later) another. */
const IDLE_SHOW_MS = 3500;
const IDLE_GAP_MS: [number, number] = [25_000, 45_000];
const FIRST_IDLE_MS = 6000;
const THINK_SHOW_MS = 1700;
const THINK_GAP_MS = 500;
const DONE_SHOW_MS = 2600;
const DONE_COOLDOWN_MS = 60_000;

function pick<T>(xs: readonly T[], avoid?: T | null): T {
  const pool = xs.length > 1 ? xs.filter((x) => x !== avoid) : xs;
  return pool[Math.floor(Math.random() * pool.length)];
}

const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);

/**
 * Dr. Albright seated on the card edge. Lifts a few px on hover (never enough
 * to show he has nothing under him), blinks, ruffles his moustache now and
 * then, and while an answer loads puffs his pipe and glances around. Speech
 * bubbles appear, stay a moment and leave; another comes later. Decorative:
 * aria-hidden figure, a polite status bubble, and no motion under
 * prefers-reduced-motion.
 */
export function AlbrightAvatar({ mood, hovered }: { mood: AlbrightMood; hovered: boolean }) {
  const [bubble, setBubble] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const lastDone = useRef(0);

  // One scheduler per mood: show → hide → wait → show another, until the mood changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const after = (ms: number, fn: () => void) => {
      timer = setTimeout(() => alive && fn(), ms);
    };
    const show = (line: string, ms: number, next: () => void) => {
      last.current = line;
      setBubble(line);
      after(ms, () => {
        setBubble(null);
        next();
      });
    };

    if (mood === "thinking") {
      const loop = () =>
        show(pick(QUIPS.thinking, last.current), THINK_SHOW_MS, () => after(THINK_GAP_MS, loop));
      loop();
    } else if (mood === "idle") {
      const loop = () => {
        // Only talk to someone who can see it.
        if (document.visibilityState !== "visible") return after(between(IDLE_GAP_MS), loop);
        show(pick(QUIPS.idle, last.current), IDLE_SHOW_MS, () => after(between(IDLE_GAP_MS), loop));
      };
      after(FIRST_IDLE_MS, loop);
    } else if (
      mood === "done" &&
      Date.now() - lastDone.current > DONE_COOLDOWN_MS &&
      Math.random() < 0.5
    ) {
      lastDone.current = Date.now();
      after(400, () => show(pick(QUIPS.done, last.current), DONE_SHOW_MS, () => {}));
    }

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      setBubble(null);
    };
  }, [mood]);

  const thinking = mood === "thinking";

  return (
    <div
      className={cn(
        "alb relative h-[148px] w-[72px] transition-transform duration-300 ease-out motion-reduce:transition-none",
        // A small lift only: the bottom 10px are tucked behind the card, so
        // anything more shows he is sitting on nothing.
        hovered && !thinking && "-translate-y-1",
        thinking && "alb-thinking"
      )}
    >
      <DrAlbrightFigure className="h-full w-full overflow-visible" />

      {/* Pipe smoke from the bowl (≈ 5px, 124px at this size): a slow drift
          always, faster while thinking. Negative delays stagger the puffs from
          the first frame instead of starting them together. */}
      <span aria-hidden className="pointer-events-none absolute left-[1px] top-[118px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="alb-puff absolute block h-3 w-3 rounded-full bg-slate-500/50 dark:bg-slate-300/50"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </span>

      {bubble && (
        <span
          role="status"
          className="alb-bubble pointer-events-none absolute right-[calc(100%+6px)] top-[80px] whitespace-nowrap rounded-2xl rounded-br-sm border bg-background px-2.5 py-1 text-xs text-foreground shadow-md"
        >
          {bubble}
        </span>
      )}

      <style jsx global>{`
        /* Parts are wrapped in transform-free groups (see dr-albright-figure),
           so fill-box origins are each part's own centre. */
        .alb .alb-eyes,
        .alb .alb-moustache {
          transform-box: fill-box;
          transform-origin: center;
        }
        .alb .alb-eyes {
          animation: alb-blink 5.5s infinite;
        }
        .alb .alb-moustache {
          animation: alb-ruffle 6s ease-in-out infinite;
        }
        .alb-thinking .alb-eyes {
          animation:
            alb-blink 5.5s infinite,
            alb-glance 2.4s ease-in-out infinite;
        }
        .alb-thinking .alb-moustache {
          animation: alb-ruffle 2.4s ease-in-out infinite;
        }
        .alb .alb-puff {
          opacity: 0;
          animation: alb-puff 4.4s ease-out infinite;
          animation-delay: calc(var(--i) * -1.1s);
        }
        .alb-thinking .alb-puff {
          animation-duration: 2s;
          animation-delay: calc(var(--i) * -0.5s);
        }
        .alb-bubble {
          animation: alb-pop 200ms ease-out;
        }
        @keyframes alb-blink {
          0%,
          93%,
          100% {
            scale: 1 1;
          }
          95% {
            scale: 1 0.15;
          }
        }
        /* A quick wiggle, then still. The moustache is ~27px wide, so it
           needs a few degrees to read at all. */
        @keyframes alb-ruffle {
          0%,
          80%,
          100% {
            rotate: 0deg;
            scale: 1 1;
          }
          83% {
            rotate: -6deg;
            scale: 1.06 0.94;
          }
          87% {
            rotate: 5deg;
            scale: 1.03 1;
          }
          91% {
            rotate: -3deg;
          }
          95% {
            rotate: 1deg;
          }
        }
        @keyframes alb-glance {
          0%,
          100% {
            translate: 0 0;
          }
          30% {
            translate: -10px 0;
          }
          65% {
            translate: 8px 2px;
          }
        }
        @keyframes alb-puff {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          50% {
            transform: translate(-8px, -30px) scale(1.4);
            opacity: 0.55;
          }
          100% {
            transform: translate(-3px, -62px) scale(2.3);
            opacity: 0;
          }
        }
        @keyframes alb-pop {
          from {
            transform: translateY(4px) scale(0.95);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .alb .alb-eyes,
          .alb .alb-moustache,
          .alb-thinking .alb-eyes,
          .alb-thinking .alb-moustache,
          .alb-bubble {
            animation: none;
          }
          .alb .alb-puff {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
