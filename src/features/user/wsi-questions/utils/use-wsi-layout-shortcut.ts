"use client";

/**
 * `F` toggles the layout; `Escape` leaves full screen.
 *
 * A bare, unmodified letter is a cheap binding but an easy way to hijack typing,
 * so it is guarded: ignored while focus is in a field or a contenteditable, and
 * ignored when any modifier is held (Cmd-F is the browser's find).
 *
 * Escape only ever exits, never enters — and stands down when a dialog is open,
 * because there Escape belongs to the dialog. Radix marks the open one in the
 * DOM, which is what the query below looks for; without that check, opening a
 * slide from a highlighted term and pressing Escape would close the dialog and
 * drop the layout in the same keystroke.
 */

import { useEffect } from "react";

import { setWsiLayout, type WsiLayout } from "./wsi-layout";

function typingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function dialogIsOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

export function useWsiLayoutShortcut(layout: WsiLayout) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (typingInto(e.target)) return;

      if (e.key === "Escape") {
        if (layout === "fullscreen" && !dialogIsOpen()) setWsiLayout("classic");
        return;
      }

      if (e.key === "f" || e.key === "F") {
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        e.preventDefault();
        setWsiLayout(layout === "fullscreen" ? "classic" : "fullscreen");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layout]);
}
