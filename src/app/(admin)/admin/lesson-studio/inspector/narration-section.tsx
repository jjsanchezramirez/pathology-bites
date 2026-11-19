// Narration script for one slide. The script is split into sentences; each
// sentence can be tied to the elements it introduces, so generated voiceover
// can bring them in as the sentence starts.

"use client";

import { useEffect, useState } from "react";
import type { Slide, SlideElement } from "../model/types";
import { useEditorStore } from "../model/store";
import { linesFromScript, scriptFromLines } from "@/shared/lesson/narration";
import { Section } from "./inputs";

const newLineId = () => `line-${Math.random().toString(36).slice(2, 9)}`;

function elementLabel(el: SlideElement): string {
  switch (el.kind) {
    case "shape":
      return el.shape;
    case "text":
      return el.text ? `"${el.text.slice(0, 18)}${el.text.length > 18 ? "…" : ""}"` : "text";
    case "svg":
      return el.svgName ?? "svg";
    case "camera":
      return `camera ${el.to.scale}×`;
    default:
      return el.kind;
  }
}

export function NarrationSection({ slide }: { slide: Slide }) {
  const { updateSlide } = useEditorStore.getState();
  const lines = slide.narration?.lines ?? [];
  const [draft, setDraft] = useState(() => scriptFromLines(lines));

  // Re-sync when switching slides or when undo/redo changes the lines.
  const committed = scriptFromLines(lines);
  useEffect(() => {
    setDraft(committed);
  }, [slide.id, committed]);

  const commit = () => {
    if (draft.trim() === committed) return;
    const next = linesFromScript(draft, lines, newLineId);
    updateSlide(slide.id, { narration: next.length ? { lines: next } : undefined });
  };

  const toggle = (lineId: string, elementId: string) => {
    const nextLines = lines.map((l) => {
      if (l.id !== lineId) {
        // An element appears once: drop it from other lines when moved here.
        return { ...l, elementIds: l.elementIds.filter((id) => id !== elementId) };
      }
      const has = l.elementIds.includes(elementId);
      return {
        ...l,
        elementIds: has
          ? l.elementIds.filter((id) => id !== elementId)
          : [...l.elementIds, elementId],
      };
    });
    updateSlide(slide.id, { narration: { lines: nextLines } });
  };

  // Full-frame background images are always on screen; don't offer them.
  const linkable = slide.elements.filter(
    (e) => !(e.kind === "image" && e.rect.w >= 99 && e.rect.h >= 99)
  );
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <Section title="Narration">
      <textarea
        value={draft}
        rows={5}
        placeholder="What the narrator says on this slide…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className="w-full resize-y rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] leading-snug outline-none focus:border-blue-500"
      />
      <div className="text-[10px] text-gray-500">
        {words} words · about {Math.round((words / 150) * 60)} s spoken
      </div>

      {lines.length > 0 && linkable.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="text-[10px] text-gray-500">Bring in with each sentence:</div>
          {lines.map((line, i) => (
            <div key={line.id} className="rounded border border-gray-200 p-1.5">
              <div className="mb-1 flex gap-1 text-[11px] text-gray-800">
                <span className="text-gray-400">{i + 1}.</span>
                <span className="flex-1">{line.text}</span>
                {line.start != null && (
                  <span className="whitespace-nowrap text-[10px] text-gray-400">
                    {line.start.toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {linkable.map((el) => {
                  const on = line.elementIds.includes(el.id);
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => toggle(line.id, el.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        on
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {elementLabel(el)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
