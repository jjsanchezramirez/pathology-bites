"use client";

/**
 * The pieces every loading state is built from, so the classic and full-screen
 * versions say the same thing in the same voice.
 *
 * There are two loading states — one where the slide is already chosen and its
 * tiles are streaming, one where nothing has been picked yet — and they used to
 * be written separately. Only the classic one ever got the rotating message,
 * which is why full screen felt bare by comparison.
 */

import { Loader2 } from "lucide-react";

/** Stem placeholder: three lines of varied width, so it reads as prose. */
export function StemSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden="true">
      <div className="h-4 w-3/4 rounded-lg bg-muted" />
      <div className="h-4 w-full rounded-lg bg-muted" />
      <div className="h-4 w-5/6 rounded-lg bg-muted" />
    </div>
  );
}

/** Five option placeholders, with the letter bubble the real options carry. */
export function OptionsSkeleton() {
  return (
    <div className="grid gap-2 animate-pulse" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-muted p-2">
          <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
          <div className="h-4 w-3/4 grow rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * What is happening and the joke about it. The message rotates on a timer in the
 * host, so this only has to render whatever it is handed — and reserve enough
 * height that a longer line doesn't nudge everything below it.
 */
export function LoadingNote({
  isWSIDataLoading,
  currentLoadingMessage,
  compact = false,
}: {
  isWSIDataLoading?: boolean;
  currentLoadingMessage: string;
  /** Beside the slide rather than over it: less room, so drop the heading. */
  compact?: boolean;
}) {
  const message = isWSIDataLoading
    ? "Connecting to virtual slide repository..."
    : currentLoadingMessage ||
      "Teaching AI the difference between normal and 'definitely not normal'...";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2 text-center"} role="status">
      <div
        className={`flex items-center gap-2 ${compact ? "" : "justify-center"} text-sm font-medium text-foreground`}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        {isWSIDataLoading ? "Loading slide data…" : "Writing your question…"}
      </div>
      <p
        className={`min-h-[2.5rem] text-xs italic leading-relaxed text-muted-foreground transition-opacity duration-500 ${
          compact ? "" : "mx-auto max-w-md"
        }`}
      >
        {message}
      </p>
    </div>
  );
}

/** Stands in for the viewer before a slide has been chosen. */
export function ViewerPlaceholder({
  isWSIDataLoading,
  currentLoadingMessage,
  fillHeight = false,
}: {
  isWSIDataLoading?: boolean;
  currentLoadingMessage: string;
  fillHeight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border bg-muted/40 ${
        fillHeight ? "h-full w-full" : "w-full"
      }`}
      style={fillHeight ? undefined : { aspectRatio: "16 / 10" }}
    >
      <LoadingNote
        isWSIDataLoading={isWSIDataLoading}
        currentLoadingMessage={currentLoadingMessage}
      />
    </div>
  );
}
