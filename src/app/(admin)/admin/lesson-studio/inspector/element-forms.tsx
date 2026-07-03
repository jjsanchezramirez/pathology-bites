// Per-kind element property forms.

"use client";

import type {
  SlideElement,
  ShapeElement,
  SpotlightElement,
  ArrowElement,
  TextElement,
  SvgElement,
  ImageElement,
  CameraElement,
  Rect,
} from "../model/types";
import { useEditorStore } from "../model/store";
import { Section, Row, NumberInput, TextInput, TextArea, ColorInput, Select } from "./inputs";
import { WaypointsSection } from "./waypoints-section";
import { clamp } from "../utils/math";
import { rectAt } from "../model/runtime";
import { frameTransformForRegion } from "@/shared/lesson/framing";
import { captionsForAudio } from "@/shared/lesson/captions";
import type { EaseName } from "@/shared/lesson/easing";
import { useState } from "react";

interface Props<T extends SlideElement> {
  element: T;
  slideId: string;
}

// Curated easing options for camera moves.
const EASE_OPTIONS: { value: EaseName; label: string }[] = [
  { value: "easeInOutCubic", label: "Smooth (in-out)" },
  { value: "easeOutCubic", label: "Glide out" },
  { value: "easeOutBack", label: "Overshoot" },
  { value: "easeOutExpo", label: "Snap out" },
  { value: "smoothstep", label: "Smoothstep" },
  { value: "linear", label: "Linear" },
];

/**
 * "Auto-frame to this region" — inserts a transient camera that pans+zooms to
 * frame the selected shape/spotlight, timed to the element's visible window.
 */
function AutoFrameButton({
  element,
  slideId,
}: {
  element: ShapeElement | SpotlightElement;
  slideId: string;
}) {
  const onClick = () => {
    const rect = rectAt(element, element.timing.start) ?? element.rect;
    const f = frameTransformForRegion(rect);
    const t = element.timing;
    const cam: CameraElement = {
      id: `camera-frame-${element.id}-${Date.now()}`,
      kind: "camera",
      to: { x: f.x, y: f.y, scale: f.scale },
      persistent: false,
      easing: "easeInOutCubic",
      timing: {
        start: t.start,
        fadeIn: Math.max(0.6, t.fadeIn),
        hold: Math.max(0.5, t.hold),
        fadeOut: Math.max(0.6, t.fadeOut),
      },
    };
    useEditorStore.getState().addElement(slideId, cam);
  };
  return (
    <Section title="Camera">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Auto-frame to this region
      </button>
    </Section>
  );
}

/**
 * "Sync to narration" — sets the element's start to when a chosen term is spoken,
 * derived from the lesson's caption timing (word-aligned when available).
 */
function SyncToNarration({ element, slideId }: { element: SlideElement; slideId: string }) {
  const [term, setTerm] = useState("");

  const sync = () => {
    const q = term.trim().toLowerCase();
    if (!q) return;
    const state = useEditorStore.getState();
    const { lesson } = state;
    const captions = captionsForAudio(lesson.audio);
    if (captions.length === 0) return;
    // Prefer an exact word match (word-aligned), else the containing chunk.
    let absolute: number | null = null;
    for (const c of captions) {
      const word = c.words?.find((w) =>
        w.text
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes(q)
      );
      if (word) {
        absolute = word.start;
        break;
      }
    }
    if (absolute == null) {
      const chunk = captions.find((c) => c.text.toLowerCase().includes(q));
      if (chunk) absolute = chunk.start;
    }
    if (absolute == null) return;
    // Convert absolute (sequence) time to slide-local time.
    let offset = 0;
    for (const s of lesson.slides) {
      if (s.id === slideId) break;
      offset += s.duration;
    }
    const localStart = Math.max(0, absolute - offset);
    state.updateElement(slideId, element.id, {
      timing: { ...element.timing, start: localStart },
    } as Partial<SlideElement>);
  };

  return (
    <Section title="Narration sync">
      <Row label="Term">
        <TextInput value={term} placeholder="e.g. stroma" onChange={setTerm} />
      </Row>
      <button
        type="button"
        onClick={sync}
        disabled={!term.trim()}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        Sync start to narration
      </button>
    </Section>
  );
}

function useUpdate<T extends SlideElement>(slideId: string, elementId: string) {
  return (patch: Partial<T>) =>
    useEditorStore.getState().updateElement(slideId, elementId, patch as Partial<SlideElement>);
}

// ---- Shared rect/position section -----------------------------------------

function RectSection({ rect, onChange }: { rect: Rect; onChange: (r: Rect) => void }) {
  return (
    <Section title="Position & size">
      <Row label="X">
        <NumberInput
          value={rect.x}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ ...rect, x: clamp(v, 0, 100) })}
        />
      </Row>
      <Row label="Y">
        <NumberInput
          value={rect.y}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ ...rect, y: clamp(v, 0, 100) })}
        />
      </Row>
      <Row label="Width">
        <NumberInput
          value={rect.w}
          step={1}
          min={0.5}
          suffix="%"
          onChange={(v) => onChange({ ...rect, w: Math.max(0.5, v) })}
        />
      </Row>
      <Row label="Height">
        <NumberInput
          value={rect.h}
          step={1}
          min={0.5}
          suffix="%"
          onChange={(v) => onChange({ ...rect, h: Math.max(0.5, v) })}
        />
      </Row>
      <Row label="Rotation">
        <NumberInput
          value={rect.rotation}
          step={1}
          suffix="°"
          onChange={(v) => onChange({ ...rect, rotation: ((v % 360) + 360) % 360 })}
        />
      </Row>
    </Section>
  );
}

// ---- Shape ----------------------------------------------------------------

export function ShapeForm({ element, slideId }: Props<ShapeElement>) {
  const update = useUpdate<ShapeElement>(slideId, element.id);
  const updateStroke = <K extends keyof ShapeElement["stroke"]>(
    key: K,
    value: ShapeElement["stroke"][K]
  ) => update({ stroke: { ...element.stroke, [key]: value } });
  return (
    <>
      <Section title="Shape">
        <Row label="Kind">
          <Select<ShapeElement["shape"]>
            value={element.shape}
            onChange={(v) => update({ shape: v })}
            options={[
              { value: "rectangle", label: "Rectangle" },
              { value: "oval", label: "Oval" },
            ]}
          />
        </Row>
        <Row label="Stroke">
          <ColorInput value={element.stroke.color} onChange={(v) => updateStroke("color", v)} />
        </Row>
        <Row label="Width">
          <NumberInput
            value={element.stroke.width}
            step={1}
            min={0}
            suffix="px"
            onChange={(v) => updateStroke("width", Math.max(0, v))}
          />
        </Row>
        <Row label="Style">
          <Select<"solid" | "dashed" | "dotted">
            value={element.stroke.style}
            onChange={(v) => updateStroke("style", v)}
            options={[
              { value: "solid", label: "Solid" },
              { value: "dashed", label: "Dashed" },
              { value: "dotted", label: "Dotted" },
            ]}
          />
        </Row>
        <Row label="Fill">
          <ColorInput value={element.fill ?? "#ffffff"} onChange={(v) => update({ fill: v })} />
        </Row>
        <Row label="Shadow">
          <input
            type="checkbox"
            checked={element.shadow ?? false}
            onChange={(e) => update({ shadow: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
        </Row>
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <AutoFrameButton element={element} slideId={slideId} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

// ---- Spotlight ------------------------------------------------------------

export function SpotlightForm({ element, slideId }: Props<SpotlightElement>) {
  const update = useUpdate<SpotlightElement>(slideId, element.id);
  return (
    <>
      <Section title="Spotlight">
        <Row label="Shape">
          <Select<SpotlightElement["shape"]>
            value={element.shape}
            onChange={(v) => update({ shape: v })}
            options={[
              { value: "oval", label: "Oval" },
              { value: "rectangle", label: "Rectangle" },
            ]}
          />
        </Row>
        <Row label="Dim">
          <NumberInput
            value={element.dimOpacity}
            step={0.05}
            min={0}
            max={1}
            onChange={(v) => update({ dimOpacity: clamp(v, 0, 1) })}
          />
        </Row>
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <AutoFrameButton element={element} slideId={slideId} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

// ---- Arrow ----------------------------------------------------------------

export function ArrowForm({ element, slideId }: Props<ArrowElement>) {
  const update = useUpdate<ArrowElement>(slideId, element.id);
  return (
    <>
      <Section title="Arrow">
        <Row label="Color">
          <ColorInput value={element.color} onChange={(v) => update({ color: v })} />
        </Row>
        <Row label="Width">
          <NumberInput
            value={element.strokeWidth}
            step={1}
            min={1}
            suffix="px"
            onChange={(v) => update({ strokeWidth: Math.max(1, v) })}
          />
        </Row>
        <Row label="Head">
          <NumberInput
            value={element.headSize}
            step={1}
            min={1}
            suffix="px"
            onChange={(v) => update({ headSize: Math.max(1, v) })}
          />
        </Row>
        <Row label="Shadow">
          <input
            type="checkbox"
            checked={element.shadow !== false}
            onChange={(e) => update({ shadow: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
        </Row>
      </Section>
      <Section title="Endpoints">
        <Row label="From X">
          <NumberInput
            value={element.from.x}
            step={1}
            suffix="%"
            onChange={(v) => update({ from: { ...element.from, x: clamp(v, 0, 100) } })}
          />
        </Row>
        <Row label="From Y">
          <NumberInput
            value={element.from.y}
            step={1}
            suffix="%"
            onChange={(v) => update({ from: { ...element.from, y: clamp(v, 0, 100) } })}
          />
        </Row>
        <Row label="To X">
          <NumberInput
            value={element.to.x}
            step={1}
            suffix="%"
            onChange={(v) => update({ to: { ...element.to, x: clamp(v, 0, 100) } })}
          />
        </Row>
        <Row label="To Y">
          <NumberInput
            value={element.to.y}
            step={1}
            suffix="%"
            onChange={(v) => update({ to: { ...element.to, y: clamp(v, 0, 100) } })}
          />
        </Row>
      </Section>
      <SyncToNarration element={element} slideId={slideId} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

// ---- Text -----------------------------------------------------------------

export function TextForm({ element, slideId }: Props<TextElement>) {
  const update = useUpdate<TextElement>(slideId, element.id);
  return (
    <>
      <Section title="Text">
        <Row label="Content">
          <TextArea value={element.text} onChange={(v) => update({ text: v })} />
        </Row>
        <Row label="Size">
          <NumberInput
            value={element.fontSize}
            step={0.25}
            min={0.5}
            suffix="cqw"
            onChange={(v) => update({ fontSize: Math.max(0.5, v) })}
          />
        </Row>
        <Row label="Weight">
          <Select<TextElement["fontWeight"]>
            value={element.fontWeight}
            onChange={(v) => update({ fontWeight: v })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "semibold", label: "Semibold" },
              { value: "bold", label: "Bold" },
            ]}
          />
        </Row>
        <Row label="Color">
          <ColorInput value={element.color} onChange={(v) => update({ color: v })} />
        </Row>
        <Row label="Bg">
          <TextInput
            value={element.background ?? ""}
            placeholder="transparent"
            onChange={(v) => update({ background: v || undefined })}
          />
        </Row>
        <Row label="Align">
          <Select<TextElement["align"]>
            value={element.align}
            onChange={(v) => update({ align: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Row>
        <Row label="Shadow">
          <input
            type="checkbox"
            checked={element.shadow !== false}
            onChange={(e) => update({ shadow: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
        </Row>
        <Row label="Animation">
          <Select<NonNullable<TextElement["animation"]>>
            value={element.animation ?? "fade"}
            onChange={(v) => update({ animation: v })}
            options={[
              { value: "fade", label: "Fade" },
              { value: "letter-by-letter", label: "Letter by letter" },
            ]}
          />
        </Row>
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <SyncToNarration element={element} slideId={slideId} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

// ---- Multi-select text editing --------------------------------------------

/**
 * Shared property editor shown when multiple text elements are selected.
 * Applies changes to all selected text elements at once.
 */
export function MultiTextForm({ elements, slideId }: { elements: TextElement[]; slideId: string }) {
  const store = useEditorStore.getState;

  const applyToAll = (patch: Partial<TextElement>) => {
    const s = store();
    s.beginDrag();
    for (const el of elements) {
      s.updateElement(slideId, el.id, patch as Partial<SlideElement>);
    }
    s.endDrag();
  };

  // Use first element as reference for current values
  const ref = elements[0];
  // Check if values are mixed across selection
  const mixedColor = elements.some((e) => e.color !== ref.color);
  const mixedSize = elements.some((e) => e.fontSize !== ref.fontSize);
  const mixedWeight = elements.some((e) => e.fontWeight !== ref.fontWeight);
  const mixedAlign = elements.some((e) => e.align !== ref.align);
  const mixedShadow = elements.some((e) => (e.shadow !== false) !== (ref.shadow !== false));
  const mixedBg = elements.some((e) => (e.background ?? "") !== (ref.background ?? ""));
  const mixedAnimation = elements.some(
    (e) => (e.animation ?? "fade") !== (ref.animation ?? "fade")
  );

  return (
    <Section title={`${elements.length} text elements`}>
      <Row label="Color">
        <ColorInput
          value={mixedColor ? "#ffffff" : ref.color}
          onChange={(v) => applyToAll({ color: v })}
        />
      </Row>
      <Row label="Size">
        <NumberInput
          value={mixedSize ? 1.4 : ref.fontSize}
          step={0.25}
          min={0.5}
          suffix="cqw"
          onChange={(v) => applyToAll({ fontSize: Math.max(0.5, v) })}
        />
      </Row>
      <Row label="Weight">
        <Select<TextElement["fontWeight"]>
          value={mixedWeight ? "normal" : ref.fontWeight}
          onChange={(v) => applyToAll({ fontWeight: v })}
          options={[
            { value: "normal", label: "Normal" },
            { value: "semibold", label: "Semibold" },
            { value: "bold", label: "Bold" },
          ]}
        />
      </Row>
      <Row label="Align">
        <Select<TextElement["align"]>
          value={mixedAlign ? "center" : ref.align}
          onChange={(v) => applyToAll({ align: v })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </Row>
      <Row label="Bg">
        <TextInput
          value={mixedBg ? "" : (ref.background ?? "")}
          placeholder={mixedBg ? "mixed" : "transparent"}
          onChange={(v) => applyToAll({ background: v || undefined })}
        />
      </Row>
      <Row label="Shadow">
        <input
          type="checkbox"
          checked={mixedShadow ? false : ref.shadow !== false}
          onChange={(e) => applyToAll({ shadow: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
      </Row>
      <Row label="Animation">
        <Select<NonNullable<TextElement["animation"]>>
          value={mixedAnimation ? "fade" : (ref.animation ?? "fade")}
          onChange={(v) => applyToAll({ animation: v })}
          options={[
            { value: "fade", label: "Fade" },
            { value: "letter-by-letter", label: "Letter by letter" },
          ]}
        />
      </Row>
    </Section>
  );
}

// ---- SVG / Image ----------------------------------------------------------

export function SvgForm({ element, slideId }: Props<SvgElement>) {
  const update = useUpdate<SvgElement>(slideId, element.id);
  return (
    <>
      <Section title="SVG">
        {element.svgName && (
          <Row label="Name">
            <span className="truncate text-xs text-muted-foreground">{element.svgName}</span>
          </Row>
        )}
        <Row label="Opacity">
          <NumberInput
            value={element.opacity ?? 1}
            step={0.05}
            min={0}
            max={1}
            onChange={(v) => update({ opacity: clamp(v, 0, 1) })}
          />
        </Row>
        <Row label="Tint">
          <ColorInput value={element.color ?? "#ffffff"} onChange={(v) => update({ color: v })} />
        </Row>
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

export function ImageForm({ element, slideId }: Props<ImageElement>) {
  const update = useUpdate<ImageElement>(slideId, element.id);
  return (
    <>
      <Section title="Image">
        <Row label="Opacity">
          <NumberInput
            value={element.opacity ?? 1}
            step={0.05}
            min={0}
            max={1}
            onChange={(v) => update({ opacity: clamp(v, 0, 1) })}
          />
        </Row>
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
  );
}

// ---- Camera (unified zoom/pan) --------------------------------------------

export function CameraForm({ element, slideId }: Props<CameraElement>) {
  const update = useUpdate<CameraElement>(slideId, element.id);
  const title = element.persistent ? "Camera (hold)" : "Camera (return)";
  return (
    <Section title={title}>
      <Row label="Hold">
        <input
          type="checkbox"
          checked={element.persistent}
          onChange={(e) => update({ persistent: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
      </Row>
      <Row label="To X">
        <NumberInput
          value={element.to.x}
          step={1}
          suffix="%"
          onChange={(v) => update({ to: { ...element.to, x: clamp(v, 0, 100) } })}
        />
      </Row>
      <Row label="To Y">
        <NumberInput
          value={element.to.y}
          step={1}
          suffix="%"
          onChange={(v) => update({ to: { ...element.to, y: clamp(v, 0, 100) } })}
        />
      </Row>
      <Row label="Scale">
        <NumberInput
          value={element.to.scale}
          step={0.05}
          min={0.1}
          suffix="×"
          onChange={(v) => update({ to: { ...element.to, scale: Math.max(0.1, v) } })}
        />
      </Row>
      <Row label="Ease">
        <Select<EaseName>
          value={element.easing ?? "easeInOutCubic"}
          onChange={(v) => update({ easing: v })}
          options={EASE_OPTIONS}
        />
      </Row>
    </Section>
  );
}
