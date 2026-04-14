// One slide thumbnail in the filmstrip. Shows the background image, duration,
// element count, and a delete-on-hover affordance.

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import type { Slide } from "../model/types";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const THUMB_WIDTH_PX = 120;

export function SlideThumbnail({
  slide,
  index,
  selected,
  onSelect,
  onDelete,
}: SlideThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: THUMB_WIDTH_PX,
  };

  const visibleCount = slide.elements.filter((e) => e.kind !== "zoom" && e.kind !== "pan").length;
  const cameraCount = slide.elements.filter((e) => e.kind === "zoom" || e.kind === "pan").length;
  // If the bottom element is a full-canvas image, use it as the thumbnail background.
  const thumbBg = (() => {
    const first = slide.elements[0];
    if (
      first &&
      first.kind === "image" &&
      first.rect.x <= 0.5 &&
      first.rect.y <= 0.5 &&
      first.rect.w >= 99.5 &&
      first.rect.h >= 99.5
    ) {
      return first.imageUrl;
    }
    return null;
  })();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onClick={onSelect}
      className={[
        "group relative flex-shrink-0 cursor-grab overflow-hidden rounded-md border-2 bg-black active:cursor-grabbing",
        selected ? "border-blue-500 shadow-md" : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      <div className="relative" style={{ aspectRatio: "16 / 9" }}>
        {thumbBg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumbBg} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full" style={{ background: slide.backgroundColor ?? "#fff" }} />
        )}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          <span>#{index + 1}</span>
          <span>{slide.duration}s</span>
        </div>
        {(visibleCount > 0 || cameraCount > 0) && (
          <div className="absolute left-1 top-1 flex gap-1 text-[9px]">
            {visibleCount > 0 && (
              <span className="rounded bg-blue-600/90 px-1 py-0.5 text-white">{visibleCount}</span>
            )}
            {cameraCount > 0 && (
              <span className="rounded bg-teal-600/90 px-1 py-0.5 text-white">{cameraCount}c</span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/70 text-white group-hover:flex hover:bg-red-500"
          title="Delete slide"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
