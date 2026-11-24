"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import { DrAlbrightFigure } from "@/shared/components/common/dr-albright-figure";
import { AlbrightMotionStyles } from "@/shared/components/common/dr-albright-motion";

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
      <span aria-hidden className="pointer-events-none absolute left-[2px] top-[120px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="alb-puff absolute block h-2 w-2 rounded-full bg-slate-500/50 dark:bg-slate-300/50"
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

      <AlbrightMotionStyles />
    </div>
  );
}
