// Horizontal filmstrip of slide thumbnails. Drag to reorder (@dnd-kit/sortable).
// The "+" button adds a blank slide or a scene from one of the templates, after
// the selected slide.

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
import { slideFromScene, starterScene } from "@/shared/lesson/templates";
import { TEMPLATES, TEMPLATE_ORDER } from "@/shared/lesson/script/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

export function Filmstrip() {
  const slides = useEditorStore((s) => s.lesson.slides);
  const selectedSlideId = useEditorStore((s) => s.selection.slideId);
  const { selectSlide, removeSlide, reorderSlides, addSlide } = useEditorStore.getState();
  // New scenes go right after the selected slide (or at the end).
  const selectedIndex = slides.findIndex((s) => s.id === selectedSlideId);
  const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : slides.length;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-[67.5px] w-28 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500"
            title="Add a scene"
          >
            <Plus className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-72">
          <DropdownMenuLabel>Add scene</DropdownMenuLabel>
          {TEMPLATE_ORDER.map((kind) => (
            <DropdownMenuItem
              key={kind}
              className="flex flex-col items-start gap-0.5"
              onSelect={() => addSlide(slideFromScene(starterScene(kind)), insertAt)}
            >
              <span className="font-medium">{TEMPLATES[kind].label}</span>
              <span className="text-xs text-muted-foreground">{TEMPLATES[kind].hint}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => addSlide(blankSlide(), insertAt)}>
            Blank slide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
