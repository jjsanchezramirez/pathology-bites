// Auto timing for one element: which narration sentence it follows, and
// whether it stays or leaves when the next sentence starts. "Manual" means the
// element keeps the timing set below or by dragging its bar.

"use client";

import { useEditorStore, selectCurrentSlide } from "../model/store";
import type { SlideElement } from "../model/types";
import { Row, Section, Select } from "./inputs";

type Mode = "manual" | "build" | "beat";

export function AutoTimingSection({
  element,
  slideId,
}: {
  element: SlideElement;
  slideId: string;
}) {
  const slide = useEditorStore(selectCurrentSlide);
  const lines = slide?.narration?.lines ?? [];
  if (!slide || (!lines.length && !element.cue)) return null;

  const lineIndex = lines.findIndex((l) => l.elementIds.includes(element.id));
  const mode: Mode = element.cue ?? "manual";

  function setMode(next: Mode) {
    useEditorStore.getState().updateElement(slideId, element.id, {
      cue: next === "manual" ? undefined : next,
    } as Partial<SlideElement>);
  }

  function setLine(value: string) {
    const target = value === "none" ? -1 : Number(value);
    const store = useEditorStore.getState();
    const s = store.lesson.slides.find((x) => x.id === slideId);
    if (!s?.narration) return;
    store.updateSlide(slideId, {
      narration: {
        ...s.narration,
        lines: s.narration.lines.map((l, i) => {
          const without = l.elementIds.filter((id) => id !== element.id);
          return { ...l, elementIds: i === target ? [...without, element.id] : without };
        }),
      },
    });
    // Picking a sentence turns auto timing on.
    if (target >= 0 && !element.cue) setMode("build");
  }

  return (
    <Section title="Narration">
      <Row label="Timing">
        <Select<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "build", label: "Auto: appear and stay" },
            { value: "beat", label: "Auto: only during its sentence" },
            { value: "manual", label: "Manual" },
          ]}
        />
      </Row>
      <Row label="Sentence">
        <Select<string>
          value={lineIndex >= 0 ? String(lineIndex) : "none"}
          onChange={setLine}
          options={[
            { value: "none", label: element.cue ? "None (whole slide)" : "None" },
            ...lines.map((l, i) => ({
              value: String(i),
              label: `${i + 1}. ${l.text.length > 34 ? `${l.text.slice(0, 34)}…` : l.text}`,
            })),
          ]}
        />
      </Row>
    </Section>
  );
}
