"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, ChevronRight, GripVertical } from "lucide-react";
import type { StudyResource } from "../lib/types";
import { textColorFor } from "../lib/color-utils";

export function SortableResourceRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const handle = (
    <button
      type="button"
      className="cursor-grab touch-none px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "z-50 opacity-80 shadow-lg ring-2 ring-ring/30" : ""}
    >
      {children(handle)}
    </div>
  );
}

export function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft size={18} />
      </Button>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

export function ResourceItem({
  resource,
  onEdit,
}: {
  resource: StudyResource;
  onEdit: () => void;
}) {
  const inactive = !resource.active;
  const textColor = textColorFor(resource.color);
  return (
    <button
      onClick={onEdit}
      className={`flex w-full items-center gap-2.5 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${
        inactive ? "opacity-40" : ""
      }`}
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
        style={{ backgroundColor: resource.color, color: textColor }}
      >
        {resource.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{resource.name}</span>
          {inactive && <span className="shrink-0 text-[10px] text-muted-foreground">Inactive</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {resource.type} · {resource.subjects?.filter((s) => s.active !== false).length || 0}{" "}
          subjects
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
    </button>
  );
}
