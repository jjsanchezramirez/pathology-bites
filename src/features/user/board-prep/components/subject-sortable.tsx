"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SubjectSortableProps {
  items: string[];
  onChange: (items: string[]) => void;
  label: string;
  labelMap?: Record<string, string>;
}

function SortableItem({ id, label, rank }: { id: string; label: string; rank: number }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm ${
        isDragging ? "z-50 opacity-80 shadow-lg ring-2 ring-ring/30" : ""
      }`}
    >
      <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{rank}</span>
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span className="flex-1 text-foreground">{label}</span>
    </div>
  );
}

export function SubjectSortable({ items, onChange, label, labelMap }: SubjectSortableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      onChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No subjects configured
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item, i) => (
              <SortableItem key={item} id={item} label={labelMap?.[item] || item} rank={i + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
