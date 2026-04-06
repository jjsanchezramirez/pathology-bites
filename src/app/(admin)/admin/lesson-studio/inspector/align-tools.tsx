// Multi-selection alignment & distribution.
// Operates on the selection bounding box; arrows and camera ops are skipped.

"use client";

import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useEditorStore } from "../model/store";
import type { SlideElement } from "../model/types";
import { Section } from "./inputs";

type Edge = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

function rectOf(el: SlideElement): { x: number; y: number; w: number; h: number } | null {
  if (el.kind === "arrow" || el.kind === "zoom" || el.kind === "pan") return null;
  return { x: el.rect.x, y: el.rect.y, w: el.rect.w, h: el.rect.h };
}

function edgeValue(el: SlideElement, edge: Edge): number {
  const r = rectOf(el)!;
  switch (edge) {
    case "left":
      return r.x;
    case "centerX":
      return r.x + r.w / 2;
    case "right":
      return r.x + r.w;
    case "top":
      return r.y;
    case "centerY":
      return r.y + r.h / 2;
    case "bottom":
      return r.y + r.h;
  }
}

interface AlignToolsProps {
  slideId: string;
  elements: SlideElement[];
}

export function AlignTools({ slideId, elements }: AlignToolsProps) {
  const alignable = elements.filter((e) => rectOf(e) !== null);
  if (alignable.length < 2) return null;

  function align(edge: Edge) {
    const store = useEditorStore.getState();
    store.beginDrag();
    const values = alignable.map((e) => edgeValue(e, edge));
    const target =
      edge === "left" || edge === "top"
        ? Math.min(...values)
        : edge === "right" || edge === "bottom"
          ? Math.max(...values)
          : values.reduce((a, b) => a + b, 0) / values.length;
    for (const el of alignable) {
      const r = rectOf(el)!;
      let nx = r.x;
      let ny = r.y;
      switch (edge) {
        case "left":
          nx = target;
          break;
        case "centerX":
          nx = target - r.w / 2;
          break;
        case "right":
          nx = target - r.w;
          break;
        case "top":
          ny = target;
          break;
        case "centerY":
          ny = target - r.h / 2;
          break;
        case "bottom":
          ny = target - r.h;
          break;
      }
      if ("rect" in el) {
        store.updateElement(slideId, el.id, {
          rect: { ...el.rect, x: nx, y: ny },
        } as Partial<SlideElement>);
      }
    }
    store.endDrag();
  }

  function distribute(axis: "x" | "y") {
    if (alignable.length < 3) return;
    const store = useEditorStore.getState();
    store.beginDrag();
    const items = alignable
      .map((e) => ({
        el: e,
        center: edgeValue(e, axis === "x" ? "centerX" : "centerY"),
      }))
      .sort((a, b) => a.center - b.center);
    const first = items[0].center;
    const last = items[items.length - 1].center;
    const step = (last - first) / (items.length - 1);
    for (let i = 1; i < items.length - 1; i++) {
      const el = items[i].el;
      const r = rectOf(el)!;
      const newCenter = first + step * i;
      const nx = axis === "x" ? newCenter - r.w / 2 : r.x;
      const ny = axis === "y" ? newCenter - r.h / 2 : r.y;
      if ("rect" in el) {
        store.updateElement(slideId, el.id, {
          rect: { ...el.rect, x: nx, y: ny },
        } as Partial<SlideElement>);
      }
    }
    store.endDrag();
  }

  const Btn = ({
    icon: Icon,
    title,
    onClick,
    disabled,
  }: {
    icon: typeof AlignStartHorizontal;
    title: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white hover:border-blue-500 disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <Section title={`${alignable.length} selected`}>
      <div className="flex gap-1">
        <Btn icon={AlignStartVertical} title="Align left" onClick={() => align("left")} />
        <Btn icon={AlignCenterVertical} title="Align center" onClick={() => align("centerX")} />
        <Btn icon={AlignEndVertical} title="Align right" onClick={() => align("right")} />
        <div className="w-1" />
        <Btn icon={AlignStartHorizontal} title="Align top" onClick={() => align("top")} />
        <Btn icon={AlignCenterHorizontal} title="Align middle" onClick={() => align("centerY")} />
        <Btn icon={AlignEndHorizontal} title="Align bottom" onClick={() => align("bottom")} />
      </div>
      <div className="flex gap-1">
        <Btn
          icon={AlignHorizontalDistributeCenter}
          title="Distribute horizontally"
          onClick={() => distribute("x")}
          disabled={alignable.length < 3}
        />
        <Btn
          icon={AlignVerticalDistributeCenter}
          title="Distribute vertically"
          onClick={() => distribute("y")}
          disabled={alignable.length < 3}
        />
      </div>
    </Section>
  );
}
