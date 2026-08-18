"use client";

/**
 * How a slide question is laid out.
 *
 * `classic` — the long-standing stacked reading order: stem, then slide, then
 * options, in a centred column.
 *
 * `fullscreen` — the slide fills the content area with the question docked
 * beside it, and the shell collapses its sidebar to a rail. Built for reading
 * the slide rather than the text: at classic sizes the viewer is a few hundred
 * pixels tall, which is not enough to actually work a case. The header stays
 * put — this widens the workspace, it does not hide the app.
 *
 * The value lives in a module store rather than component state because two
 * places need the same answer: the generator (which renders the layout and owns
 * the picker) and the page (which drops its own heading and asks the shell to
 * collapse). Passing it between them would mean threading props through a
 * component that has no other reason to know about the page.
 */

import { useSyncExternalStore } from "react";

export type WsiLayout = "classic" | "fullscreen";

export const WSI_LAYOUT_STORAGE_KEY = "wsi-question-layout";

// Starts at "classic" on both server and client so the first client render
// matches the server's. `hydrateWsiLayout` applies the stored preference in an
// effect, after hydration has already agreed.
let current: WsiLayout = "classic";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWsiLayout(next: WsiLayout) {
  if (next === current) return;
  current = next;
  emit();
  try {
    window.localStorage.setItem(WSI_LAYOUT_STORAGE_KEY, next);
  } catch {
    // Private browsing — the preference just won't persist.
  }
}

/** Apply the stored preference. Safe to call from several components: idempotent. */
export function hydrateWsiLayout() {
  try {
    const saved = window.localStorage.getItem(WSI_LAYOUT_STORAGE_KEY);
    if (saved === "classic" || saved === "fullscreen") setWsiLayout(saved);
  } catch {
    // No storage access — stay on the default.
  }
}

export function useWsiLayout(): WsiLayout {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "classic" as const
  );
}

/** Test seam: drop back to the default between cases. */
export function resetWsiLayout() {
  current = "classic";
  emit();
}
