"use client";

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Input } from "@/shared/components/ui/input";
import type { StudyResource, PhaseResourceAssignment, FixedDistribution } from "../../lib/types";
import { PanelHeader, SortableResourceRow } from "../setup-sheet-parts";

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  qbank: "Qbank",
  book: "Book",
  video: "Video",
  flashcards: "Cards",
};

const SHAPES: { id: FixedDistribution; label: string }[] = [
  { id: "flat", label: "Flat" },
  { id: "front", label: "Front" },
  { id: "middle", label: "Middle" },
  { id: "end", label: "End" },
];

export function PhaseResourcesPanel({
  phaseName,
  assignments,
  resources,
  sensors,
  onAssignmentsChange,
  onBack,
}: {
  phaseName: string;
  assignments: PhaseResourceAssignment[];
  resources: StudyResource[];
  sensors: SensorDescriptor<SensorOptions>[];
  onAssignmentsChange: (next: PhaseResourceAssignment[]) => void;
  onBack: () => void;
}) {
  const assignedIds = new Set(assignments.map((a) => a.resource_id));
  const unassignedResources = resources.filter((r) => !assignedIds.has(r.id));

  const cycleResourceMode = (resId: string) => {
    const existing = assignments.find((r) => r.resource_id === resId);
    if (!existing) {
      onAssignmentsChange([...assignments, { resource_id: resId, mode: "study" }]);
    } else if (existing.mode === "study") {
      onAssignmentsChange(
        assignments.map((r) =>
          r.resource_id === resId ? { ...r, mode: "review", review_pct: 50 } : r
        )
      );
    } else {
      onAssignmentsChange(assignments.filter((r) => r.resource_id !== resId));
    }
  };

  const updateAssignment = (resId: string, patch: Partial<PhaseResourceAssignment>) => {
    onAssignmentsChange(assignments.map((r) => (r.resource_id === resId ? { ...r, ...patch } : r)));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = assignments.findIndex((r) => r.resource_id === active.id);
    const newIdx = assignments.findIndex((r) => r.resource_id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onAssignmentsChange(arrayMove(assignments, oldIdx, newIdx));
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={`Resources — ${phaseName}`} onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {assignments.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Assigned · drag to reorder (top = highest priority)
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={assignments.map((a) => a.resource_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-border">
                  {assignments.map((assignment, i) => {
                    const resource = resources.find((r) => r.id === assignment.resource_id);
                    if (!resource) return null;
                    const mode = assignment.mode;
                    const isFixed = resource.type === "qbank" || resource.type === "flashcards";
                    const shape = assignment.distribution || "flat";
                    return (
                      <SortableResourceRow key={resource.id} id={resource.id}>
                        {(handle) => (
                          <div>
                            <div className="flex items-center gap-1.5 px-2 py-2.5">
                              {handle}
                              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                                {i + 1}
                              </span>
                              <button
                                onClick={() => cycleResourceMode(resource.id)}
                                className="flex flex-1 items-center gap-2.5 text-left hover:bg-muted/30"
                              >
                                <div
                                  className={`flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                    mode === "study"
                                      ? "bg-sky-200 text-sky-800"
                                      : "bg-amber-200 text-amber-800"
                                  }`}
                                >
                                  {mode === "study" ? "S" : "R"}
                                </div>
                                <div
                                  className="size-4 shrink-0 rounded border border-border"
                                  style={{ backgroundColor: resource.color }}
                                />
                                <span className="flex-1 truncate text-sm text-foreground">
                                  {resource.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {RESOURCE_TYPE_LABEL[resource.type] ?? "Cards"}
                                </span>
                              </button>
                            </div>
                            {mode === "review" && (
                              <div className="flex items-center gap-2 bg-muted/20 px-4 py-1.5 pl-12">
                                <span className="text-xs text-muted-foreground">Review</span>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={assignment.review_pct ?? 50}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "" || /^\d+$/.test(v))
                                      updateAssignment(resource.id, {
                                        review_pct: Math.min(100, parseInt(v) || 0),
                                      });
                                  }}
                                  className="h-6 w-12 text-center text-xs"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            )}
                            {isFixed && (
                              <div className="flex flex-wrap items-center gap-1.5 bg-muted/20 px-4 py-1.5 pl-12">
                                <span className="text-xs text-muted-foreground">Distribution</span>
                                <div className="flex overflow-hidden rounded-md border border-border">
                                  {SHAPES.map((s) => (
                                    <button
                                      key={s.id}
                                      onClick={() =>
                                        updateAssignment(resource.id, { distribution: s.id })
                                      }
                                      className={`px-2 py-0.5 text-[11px] transition-colors ${
                                        shape === s.id
                                          ? "bg-primary text-primary-foreground"
                                          : "hover:bg-muted"
                                      }`}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </SortableResourceRow>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {unassignedResources.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Available · tap to add
            </div>
            <div className="divide-y divide-border">
              {unassignedResources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => cycleResourceMode(resource.id)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left opacity-60 transition-colors hover:opacity-100 hover:bg-muted/30"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded border border-muted-foreground/30 text-[10px] font-bold text-muted-foreground">
                    —
                  </div>
                  <div
                    className="size-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: resource.color }}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">{resource.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {RESOURCE_TYPE_LABEL[resource.type] ?? "Cards"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-center gap-4 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-flex size-3.5 items-center justify-center rounded bg-sky-200 text-[8px] font-bold text-sky-800">
              S
            </span>{" "}
            Study
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex size-3.5 items-center justify-center rounded bg-amber-200 text-[8px] font-bold text-amber-800">
              R
            </span>{" "}
            Review
          </span>
          <span>Tap row to cycle study → review → remove</span>
        </div>
      </div>
    </div>
  );
}
