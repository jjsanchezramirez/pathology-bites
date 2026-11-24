"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import { DrAlbrightFigure } from "./dr-albright-figure";

export type AlbrightMood = "idle" | "thinking" | "done";

/**
 * Lines Dr. Albright says. Short and dry on purpose — whimsy wears thin fast,
 * so idle/done lines are rate-limited below; the thinking lines are status.
 */
const QUIPS = {
  idle: [
    "Got a differential?",
    "Ask me about a stain.",
    "WHO, PubMed or PathologyOutlines. I read all three.",
    "No question too basic.",
  ],
  thinking: [
    "Checking PathologyOutlines…",
    "Consulting the WHO…",
    "Searching PubMed…",
    "Reading the stains…",
  ],
  done: ["Here's what the sources say.", "A classic.", "Worth a look at the panel."],
} as const;

const IDLE_COOLDOWN_MS = 45_000;
const DONE_COOLDOWN_MS = 60_000;
const BUBBLE_MS = 2600;

function pick<T>(xs: readonly T[], avoid?: T): T {
  const pool = xs.length > 1 ? xs.filter((x) => x !== avoid) : xs;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Dr. Albright seated on the card edge. Rises a little on hover, blinks every
 * few seconds, puffs his pipe and glances around while an answer loads, and
 * now and then says something in a bubble. Pure decoration: aria-hidden, and
 * every animation stops under prefers-reduced-motion.
 */
export function AlbrightAvatar({ mood, hovered }: { mood: AlbrightMood; hovered: boolean }) {
  const [bubble, setBubble] = useState<string | null>(null);
  const lastIdle = useRef(0);
  const lastDone = useRef(0);
  const lastLine = useRef<string | undefined>(undefined);

  const say = (line: string, ms = BUBBLE_MS) => {
    lastLine.current = line;
    setBubble(line);
    if (ms > 0) {
      const t = setTimeout(() => setBubble((b) => (b === line ? null : b)), ms);
      return () => clearTimeout(t);
    }
  };

  // Hover: an idle line at most every 45s, and only half the time.
  useEffect(() => {
    if (!hovered || mood !== "idle") return;
    const now = Date.now();
    if (now - lastIdle.current < IDLE_COOLDOWN_MS || Math.random() < 0.5) return;
    lastIdle.current = now;
    return say(pick(QUIPS.idle, lastLine.current));
  }, [hovered, mood]);

  // Thinking: say what he's doing, rotating every ~1.6s until the answer lands.
  useEffect(() => {
    if (mood !== "thinking") return;
    setBubble(pick(QUIPS.thinking));
    const id = setInterval(() => setBubble((b) => pick(QUIPS.thinking, b ?? undefined)), 1600);
    return () => {
      clearInterval(id);
      setBubble(null);
    };
  }, [mood]);

  // Done: occasionally a closing line, at most once a minute.
  useEffect(() => {
    if (mood !== "done") return;
    const now = Date.now();
    if (now - lastDone.current < DONE_COOLDOWN_MS || Math.random() < 0.6) return;
    lastDone.current = now;
    return say(pick(QUIPS.done, lastLine.current));
  }, [mood]);

  const thinking = mood === "thinking";

  return (
    <div
      className={cn(
        "alb relative h-[148px] w-[72px] transition-transform duration-300 ease-out motion-reduce:transition-none",
        hovered && !thinking && "-translate-y-3",
        thinking && "alb-thinking"
      )}
    >
      <DrAlbrightFigure className="h-full w-full overflow-visible" />

      {/* Pipe smoke, from the bowl (≈ x 5px, y 130px at this size). */}
      {thinking && (
        <span aria-hidden className="pointer-events-none absolute left-[2px] top-[122px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="alb-puff absolute block h-2 w-2 rounded-full bg-muted-foreground/30"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
        </span>
      )}

      {bubble && (
        <span
          role="status"
          className="alb-bubble pointer-events-none absolute right-[calc(100%-6px)] top-[78px] max-w-[220px] whitespace-nowrap rounded-2xl rounded-br-sm border bg-background px-2.5 py-1 text-xs text-foreground shadow-md"
        >
          {bubble}
        </span>
      )}

      <style jsx global>{`
        .alb .alb-eyes {
          transform-box: fill-box;
          transform-origin: center;
          animation: alb-blink 5.5s infinite;
        }
        .alb-thinking .alb-eyes {
          animation:
            alb-blink 5.5s infinite,
            alb-glance 2.4s ease-in-out infinite;
        }
        .alb-thinking .alb-moustache {
          transform-box: fill-box;
          transform-origin: center;
          animation: alb-twitch 1.2s ease-in-out infinite;
        }
        .alb-puff {
          animation: alb-puff 1.5s ease-out infinite;
          opacity: 0;
        }
        .alb-bubble {
          animation: alb-pop 180ms ease-out;
        }
        /* The SVG positions each part with a transform attribute; CSS
           transform would replace it, so animate the separate scale /
           translate / rotate properties, which compose on top. */
        @keyframes alb-blink {
          0%,
          94%,
          100% {
            scale: 1 1;
          }
          96% {
            scale: 1 0.1;
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
        @keyframes alb-twitch {
          0%,
          100% {
            rotate: 0deg;
          }
          50% {
            rotate: -3deg;
          }
        }
        @keyframes alb-puff {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: translate(-10px, -34px) scale(2.2);
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
          .alb-thinking .alb-eyes,
          .alb-thinking .alb-moustache,
          .alb-puff,
          .alb-bubble {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
