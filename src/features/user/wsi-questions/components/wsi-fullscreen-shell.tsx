"use client";

/**
 * The full-screen layout's frame: control bar on top, slide left, question right.
 *
 * In flow, not an overlay. The shell keeps its header and collapses the sidebar
 * to a rail (see immersive-mode-context), so this fills the content area rather
 * than covering the app — the reader can still see where they are and navigate
 * away. It relies on the shell handing `main` a bounded full height, which the
 * page arranges by declaring immersive mode.
 *
 * Shared by the answered view and the generating view so the frame is one
 * element across both: React keeps it mounted between them, and the viewer does
 * not tear down and refetch its tiles on every new question.
 */

import type { ReactNode } from "react";

interface WsiFullscreenShellProps {
  className?: string;
  controls: ReactNode;
  viewer: ReactNode;
  panel: ReactNode;
  /** Rendered inside the frame but outside the grid (dialogs, etc.). */
  children?: ReactNode;
}

export function WsiFullscreenShell({
  className = "",
  controls,
  viewer,
  panel,
  children,
}: WsiFullscreenShellProps) {
  return (
    <div className={`flex h-full flex-col overflow-hidden ${className}`}>
      <div className="shrink-0 border-b bg-card px-3 py-2">{controls}</div>
      {/* Explicit rows: when stacked, an auto row would collapse the viewer to
          nothing (its height comes from the parent, not from content). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 overflow-hidden p-3 lg:col-span-2">{viewer}</div>
        <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto border-t p-4 lg:border-l lg:border-t-0">
          {panel}
        </div>
      </div>
      {children}
    </div>
  );
}
