// Horizontal filmstrip of slide thumbnails. Drag to reorder (@dnd-kit/sortable).
// Click the "+" button to append a blank slide.

"use client";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEditorStore } from "../model/store";
import { blankSlide } from "../model/slide-factory";
import { SlideThumbnail } from "./slide-thumbnail";

export function Filmstrip() {
  const slides = useEditorStore((s) => s.lesson.slides);
  const selectedSlideId = useEditorStore((s) => s.selection.slideId);
  const { selectSlide, removeSlide, reorderSlides, addSlide } = useEditorStore.getState();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = slides.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, String(active.id));
    reorderSlides(next);
  }

  return (
    <div className="flex h-28 items-center gap-2 overflow-x-auto border-t bg-white px-3 py-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2">
            {slides.map((s, idx) => (
              <SlideThumbnail
                key={s.id}
                slide={s}
                index={idx}
                selected={selectedSlideId === s.id}
                onSelect={() => selectSlide(s.id)}
                onDelete={() => removeSlide(s.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() => addSlide(blankSlide())}
        className="flex h-[67.5px] w-28 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500"
        title="Add blank slide"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
