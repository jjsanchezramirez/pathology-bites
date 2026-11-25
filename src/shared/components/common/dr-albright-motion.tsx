"use client";

/**
 * Dr. Albright's motion, shared by every place he appears (the Ask Dr. Albright
 * popup and the floating character on the homepage, 404 and error pages).
 * Animates the part classes of DrAlbrightFigure / DrAlbrightFullFigure under an
 * ancestor with class `alb`; `alb-thinking` adds the busy variants. Global so
 * it reaches inside the inline SVG; duplicate mounts are harmless (identical
 * rules). Everything stops under prefers-reduced-motion.
 */
export function AlbrightMotionStyles() {
  return (
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
          transform: translate(-6px, -22px) scale(1.15);
          opacity: 0.55;
        }
        100% {
          transform: translate(-2px, -46px) scale(1.6);
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
  );
}
