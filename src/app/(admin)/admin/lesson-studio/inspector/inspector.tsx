// Context-sensitive right-side inspector.
// No selection → slide properties
// Single element → kind-specific form + timing
// Multi-selection → alignment tools

"use client";

import { useMemo } from "react";
import { useEditorStore, selectCurrentSlide } from "../model/store";
import type { SlideElement } from "../model/types";
import { SlideProperties } from "./slide-properties";
import { TimingSection } from "./timing-section";
import { AlignTools } from "./align-tools";
import {
  ShapeForm,
  SpotlightForm,
  ArrowForm,
  TextForm,
  SvgForm,
  ImageForm,
  CameraForm,
} from "./element-forms";

export function Inspector() {
  const slide = useEditorStore(selectCurrentSlide);
  const selectedIds = useEditorStore((s) => s.selection.elementIds);
  const selected = useMemo<SlideElement[]>(() => {
    if (!slide) return [];
    const ids = new Set(selectedIds);
    return slide.elements.filter((e) => ids.has(e.id));
  }, [slide, selectedIds]);

  return (
    <div className="flex h-full w-[280px] flex-col border-l bg-white">
      <div className="border-b px-3 py-2 text-xs font-semibold">
        {!slide
          ? "Inspector"
          : selected.length === 0
            ? "Slide"
            : selected.length === 1
              ? kindLabel(selected[0])
              : `${selected.length} selected`}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!slide ? (
          <div className="p-4 text-xs text-muted-foreground">No slide selected</div>
        ) : selected.length === 0 ? (
          <SlideProperties slide={slide} />
        ) : selected.length === 1 ? (
          <SingleElementForm
            slideId={slide.id}
            element={selected[0]}
            slideDuration={slide.duration}
          />
        ) : (
          <AlignTools slideId={slide.id} elements={selected} />
        )}
      </div>
    </div>
  );
}

function SingleElementForm({
  element,
  slideId,
  slideDuration,
}: {
  element: SlideElement;
  slideId: string;
  slideDuration: number;
}) {
  const { updateElement } = useEditorStore.getState();

  function updateTiming(patch: Partial<typeof element.timing>) {
    updateElement(slideId, element.id, {
      timing: { ...element.timing, ...patch },
    } as Partial<SlideElement>);
  }

  return (
    <div>
      {renderForm(element, slideId)}
      <TimingSection
        timing={element.timing}
        onChange={updateTiming}
        slideDuration={slideDuration}
      />
    </div>
  );
}

function renderForm(element: SlideElement, slideId: string) {
  switch (element.kind) {
    case "shape":
      return <ShapeForm element={element} slideId={slideId} />;
    case "spotlight":
      return <SpotlightForm element={element} slideId={slideId} />;
    case "arrow":
      return <ArrowForm element={element} slideId={slideId} />;
    case "text":
      return <TextForm element={element} slideId={slideId} />;
    case "svg":
      return <SvgForm element={element} slideId={slideId} />;
    case "image":
      return <ImageForm element={element} slideId={slideId} />;
    case "camera":
      return <CameraForm element={element} slideId={slideId} />;
  }
}

function kindLabel(el: SlideElement): string {
  switch (el.kind) {
    case "shape":
      return `Shape · ${el.shape}`;
    case "spotlight":
      return "Spotlight";
    case "arrow":
      return "Arrow";
    case "text":
      return "Text";
    case "svg":
      return "SVG";
    case "image":
      return "Image";
    case "camera":
      return "Camera";
  }
}
