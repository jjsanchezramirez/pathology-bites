"use client";

import { useState } from "react";
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
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ArrowLeft, Plus, X, Check, GripVertical } from "lucide-react";
import { SubjectEntry } from "../lib/types";
import { CP_CATEGORIES, AP_CATEGORIES } from "../lib/categories";

function contentLabel(type: string): string {
  switch (type) {
    case "book": return "Pages";
    case "qbank": return "Questions";
    case "flashcards": return "Cards";
    case "video": return "Duration (min)";
    default: return "Amount";
  }
}

interface SortableSubjectCardProps {
  id: string;
  idx: number;
  subj: SubjectEntry;
  resourceType: string;
  isBook: boolean;
  update: (idx: number, updates: Partial<SubjectEntry>) => void;
  remove: (idx: number) => void;
  numHandler: (idx: number, field: 'content_amount' | 'start_page' | 'end_page', integer?: boolean) => {
    type: "text";
    inputMode: "numeric" | "decimal";
    value: number | string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
}

function SortableSubjectCard({ id, idx, subj, resourceType, isBook, update, remove, numHandler }: SortableSubjectCardProps) {
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
      className={`rounded-xl border border-border p-3 bg-card ${
        isDragging ? "z-50 opacity-80 shadow-lg ring-2 ring-ring/30" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
        <Input
          value={subj.name}
          onChange={(e) => update(idx, { name: e.target.value })}
          placeholder="Subject name"
          className="flex-1 text-sm font-medium"
        />
        <Button variant="ghost" size="sm" onClick={() => remove(idx)}>
          <X size={14} className="text-muted-foreground" />
        </Button>
      </div>

      <div className="mb-2">
        <label className="mb-0.5 block text-[10px] text-muted-foreground">Category</label>
        <select
          value={subj.category_id || ""}
          onChange={(e) => update(idx, { category_id: e.target.value || undefined })}
          className="h-7 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
        >
          <option value="">None</option>
          <optgroup label="Clinical Pathology">
            {CP_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Anatomic Pathology">
            {AP_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className={`grid gap-2 ${isBook ? "grid-cols-3" : "grid-cols-1"}`}>
        <div>
          <label className="mb-0.5 block text-[10px] text-muted-foreground">{contentLabel(resourceType)}</label>
          <Input {...numHandler(idx, "content_amount")} className="h-7 text-xs" />
        </div>
        {isBook && (
          <>
            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">Start pg</label>
              <Input {...numHandler(idx, "start_page")} className="h-7 text-xs" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">End pg</label>
              <Input {...numHandler(idx, "end_page")} className="h-7 text-xs" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SubjectEditPanelProps {
  subjects: SubjectEntry[];
  resourceType: string;
  resourceName: string;
  onSave: (subjects: SubjectEntry[]) => void;
  onBack: () => void;
}

export function SubjectEditPanel({ subjects: initial, resourceType, resourceName, onSave, onBack }: SubjectEditPanelProps) {
  const [subjects, setSubjects] = useState<SubjectEntry[]>([...initial.map(s => ({ ...s }))]);
  const isBook = resourceType === "book";
  const [idCounter, setIdCounter] = useState(initial.length);
  const [itemIds, setItemIds] = useState<string[]>(() => initial.map((_, i) => `subj-${i}`));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const update = (idx: number, updates: Partial<SubjectEntry>) => {
    const next = [...subjects];
    next[idx] = { ...next[idx], ...updates };
    setSubjects(next);
  };

  const addSubject = () => {
    setSubjects([...subjects, {
      name: "",
      content_amount: 0,
      activity_prefix: "",
      active: true,
      ...(isBook ? { start_page: undefined, end_page: undefined } : {}),
    }]);
    setItemIds([...itemIds, `subj-${idCounter}`]);
    setIdCounter(idCounter + 1);
  };

  const removeSubject = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
    setItemIds(itemIds.filter((_, i) => i !== idx));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);
      setSubjects(arrayMove(subjects, oldIndex, newIndex));
      setItemIds(arrayMove(itemIds, oldIndex, newIndex));
    }
  };

  const numHandler = (idx: number, field: 'content_amount' | 'start_page' | 'end_page', integer = true) => ({
    type: "text" as const,
    inputMode: (integer ? "numeric" : "decimal") as "numeric" | "decimal",
    value: subjects[idx][field] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === "") { update(idx, { [field]: 0 }); return; }
      if (integer && /^\d+$/.test(v)) { update(idx, { [field]: parseInt(v) }); }
      else if (!integer && /^\d*\.?\d*$/.test(v)) { update(idx, { [field]: parseFloat(v) || 0 }); }
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">Edit Subjects</div>
          <div className="text-xs text-muted-foreground">{resourceName} — drag to reorder</div>
        </div>
        <Button size="sm" onClick={() => onSave(subjects)}>
          <Check size={14} /> Done
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {subjects.map((subj, idx) => (
                <SortableSubjectCard
                  key={itemIds[idx]}
                  id={itemIds[idx]}
                  idx={idx}
                  subj={subj}
                  resourceType={resourceType}
                  isBook={isBook}
                  update={update}
                  remove={removeSubject}
                  numHandler={numHandler}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={addSubject}>
          <Plus size={14} /> Add Subject
        </Button>
      </div>
    </div>
  );
}
