// Form shown when no element is selected — edits the current slide.

"use client";

import type { Slide, SlideTransition, ImageCategory } from "../model/types";
import { useEditorStore } from "../model/store";
import { Section, Row, NumberInput, TimeInput, Select, ColorInput } from "./inputs";

interface SlidePropertiesProps {
  slide: Slide;
}

export function SlideProperties({ slide }: SlidePropertiesProps) {
  const { updateSlide } = useEditorStore.getState();

  return (
    <div>
      <Section title="Slide">
        <Row label="Duration">
          <TimeInput
            value={slide.duration}
            min={1}
            onChange={(v) => updateSlide(slide.id, { duration: Math.max(1, v) })}
          />
        </Row>
        <Row label="Category">
          <Select<ImageCategory>
            value={slide.imageCategory ?? "blank"}
            onChange={(v) => updateSlide(slide.id, { imageCategory: v })}
            options={[
              { value: "microscopic", label: "Microscopic" },
              { value: "gross", label: "Gross" },
              { value: "figure", label: "Figure" },
              { value: "table", label: "Table" },
              { value: "diagram", label: "Diagram" },
              { value: "blank", label: "Blank" },
            ]}
          />
        </Row>
      </Section>

      <Section title="Transition (in)">
        <Row label="Kind">
          <Select<SlideTransition["kind"]>
            value={slide.transitionIn.kind}
            onChange={(v) =>
              updateSlide(slide.id, {
                transitionIn: { ...slide.transitionIn, kind: v },
              })
            }
            options={[
              { value: "crossfade", label: "Crossfade" },
              { value: "cut", label: "Cut" },
              { value: "fade-to-black", label: "Fade to black" },
            ]}
          />
        </Row>
        <Row label="Duration">
          <TimeInput
            value={slide.transitionIn.duration}
            min={0}
            onChange={(v) =>
              updateSlide(slide.id, {
                transitionIn: { ...slide.transitionIn, duration: Math.max(0, v) },
              })
            }
          />
        </Row>
      </Section>

      <Section title="Initial framing">
        <Row label="X">
          <NumberInput
            value={slide.initialFraming.x}
            step={1}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) =>
              updateSlide(slide.id, {
                initialFraming: { ...slide.initialFraming, x: clamp(v, 0, 100) },
              })
            }
          />
        </Row>
        <Row label="Y">
          <NumberInput
            value={slide.initialFraming.y}
            step={1}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) =>
              updateSlide(slide.id, {
                initialFraming: { ...slide.initialFraming, y: clamp(v, 0, 100) },
              })
            }
          />
        </Row>
        <Row label="Scale">
          <NumberInput
            value={slide.initialFraming.scale}
            step={0.05}
            min={0.1}
            max={5}
            suffix="×"
            onChange={(v) =>
              updateSlide(slide.id, {
                initialFraming: { ...slide.initialFraming, scale: Math.max(0.1, v) },
              })
            }
          />
        </Row>
      </Section>

      {!slide.elements.some(
        (e) =>
          e.kind === "image" &&
          e.rect.x === 0 &&
          e.rect.y === 0 &&
          e.rect.w === 100 &&
          e.rect.h === 100
      ) && (
        <Section title="Background">
          <Row label="Color">
            <ColorInput
              value={slide.backgroundColor ?? "#ffffff"}
              onChange={(v) => updateSlide(slide.id, { backgroundColor: v })}
            />
          </Row>
        </Section>
      )}
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
