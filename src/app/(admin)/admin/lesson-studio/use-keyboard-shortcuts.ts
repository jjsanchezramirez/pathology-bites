// Global keyboard shortcuts for the editor:
//   ⌘Z / ⌘⇧Z — undo / redo
//   Delete / Backspace — remove selected elements
//   Escape — clear selection or exit preview mode
// Shortcuts are ignored when focus is in an input/textarea.

"use client";

import { useEffect } from "react";
import { useEditorStore } from "./model/store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;

      const meta = e.metaKey || e.ctrlKey;
      const store = useEditorStore.getState();

      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !meta) {
        if (store.selection.slideId && store.selection.elementIds.length > 0) {
          e.preventDefault();
          for (const id of store.selection.elementIds) {
            store.removeElement(store.selection.slideId, id);
          }
        }
        return;
      }
      if (e.key === "Escape") {
        if (store.mode === "preview") {
          store.setMode("edit");
        } else {
          store.clearSelection();
          if (store.tool !== "select") store.setTool("select");
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
