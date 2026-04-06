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
  ZoomElement,
  PanElement,
  Rect,
} from "../model/types";
import { useEditorStore } from "../model/store";
import { Section, Row, NumberInput, TextInput, TextArea, ColorInput, Select } from "./inputs";
import { WaypointsSection } from "./waypoints-section";
import { clamp } from "../utils/math";

interface Props<T extends SlideElement> {
  element: T;
  slideId: string;
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
              { value: "circle", label: "Circle" },
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
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
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
              { value: "circle", label: "Circle" },
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
      </Section>
      <RectSection rect={element.rect} onChange={(rect) => update({ rect })} />
      <WaypointsSection element={element} slideId={slideId} />
    </>
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

// ---- Zoom / Pan (camera ops) ---------------------------------------------

function CameraForm({
  element,
  slideId,
  title,
}: Props<ZoomElement | PanElement> & { title: string }) {
  const update = useUpdate<ZoomElement | PanElement>(slideId, element.id);
  return (
    <Section title={title}>
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
    </Section>
  );
}

export function ZoomForm(props: Props<ZoomElement>) {
  return <CameraForm {...props} title="Zoom target" />;
}
export function PanForm(props: Props<PanElement>) {
  return <CameraForm {...props} title="Pan target" />;
}
