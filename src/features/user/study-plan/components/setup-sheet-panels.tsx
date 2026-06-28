"use client";

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Plus, X, ChevronRight } from "lucide-react";
import type {
  StudyResource,
  PhaseConfig,
  PhaseResourceAssignment,
  FixedDistribution,
} from "../lib/types";
import { PHASE_PALETTE } from "../lib/color-utils";
import type { estimatePhaseHours } from "../lib/scheduler";
import { SubjectSortable } from "./subject-sortable";
import { PanelHeader, SortableResourceRow, ResourceItem } from "./setup-sheet-parts";
import { fmtRange, surplusColor, surplusBarColor } from "./setup-sheet-utils";

type PhaseEstimate = ReturnType<typeof estimatePhaseHours>[number];
type ExamDate = { name: string; date: string };

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  qbank: "Qbank",
  book: "Book",
  video: "Video",
  flashcards: "Cards",
};

export function ExamsPanel({
  examDates,
  onChange,
  onBack,
}: {
  examDates: ExamDate[];
  onChange: (exams: ExamDate[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Exam Dates" onBack={onBack} />
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {examDates.map((exam, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={exam.name}
              onChange={(e) => {
                const exams = [...examDates];
                exams[idx] = { ...exams[idx], name: e.target.value };
                onChange(exams);
              }}
              placeholder="Exam name"
              className="flex-1"
            />
            <Input
              type="date"
              value={exam.date}
              onChange={(e) => {
                const exams = [...examDates];
                exams[idx] = { ...exams[idx], date: e.target.value };
                onChange(exams);
              }}
              className="w-[140px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(examDates.filter((_, i) => i !== idx))}
            >
              <X size={14} className="text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...examDates, { name: "", date: "" }])}
        >
          <Plus size={14} /> Add Exam
        </Button>
      </div>
    </div>
  );
}

export function PhasesPanel({
  phases,
  onOpenPhase,
  onAddPhase,
  onBack,
}: {
  phases: PhaseConfig[];
  onOpenPhase: (idx: number) => void;
  onAddPhase: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Phases" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {phases.map((phase, idx) => {
          const palette = PHASE_PALETTE[idx % PHASE_PALETTE.length];
          return (
            <button
              key={idx}
              onClick={() => onOpenPhase(idx)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: palette.accent }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {phase.name || `Phase ${idx + 1}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtRange(phase.start_date, phase.end_date)} · {phase.resources?.length || 0}{" "}
                  resources
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </button>
          );
        })}
        <div className="p-4">
          <Button variant="outline" size="sm" className="w-full" onClick={onAddPhase}>
            <Plus size={14} /> Add Phase
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResourcesPanel({
  resources,
  onEditResource,
  onAddResource,
  onBack,
}: {
  resources: StudyResource[];
  onEditResource: (resource: StudyResource) => void;
  onAddResource: () => void;
  onBack: () => void;
}) {
  const typeOrder: Record<string, number> = { book: 0, qbank: 1, video: 2, flashcards: 3 };
  const sorted = [...resources].sort(
    (a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) || a.name.localeCompare(b.name)
  );
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Resources" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {sorted.map((resource) => (
          <ResourceItem
            key={resource.id}
            resource={resource}
            onEdit={() => onEditResource(resource)}
          />
        ))}
        <div className="p-4">
          <Button variant="outline" size="sm" className="w-full" onClick={onAddResource}>
            <Plus size={14} /> Add Resource
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SubjectOrderPanel({
  phaseName,
  items,
  labelMap,
  onChange,
  onBack,
}: {
  phaseName: string;
  items: string[];
  labelMap: Record<string, string>;
  onChange: (next: string[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={`Subject Order — ${phaseName}`} onBack={onBack} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground">
          Drag to reorder. The scheduler fully drains subject 1 before moving to subject 2.
        </p>
        <SubjectSortable
          label={`Subjects (${items.length})`}
          items={items}
          labelMap={labelMap}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function ResourceMatrixPanel({
  phases,
  resources,
  estimates,
  onCycle,
  onBack,
}: {
  phases: PhaseConfig[];
  resources: StudyResource[];
  estimates: PhaseEstimate[];
  onCycle: (resId: string, phaseIdx: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Resource Matrix" onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {phases.length === 0 || resources.length === 0 ? (
          <div className="rounded-xl bg-muted/40 py-8 text-center text-sm text-muted-foreground">
            {phases.length === 0 ? "Add phases first" : "Add resources first"}
          </div>
        ) : (
          <>
            <div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                        Resource
                      </th>
                      {phases.map((phase, idx) => {
                        const palette = PHASE_PALETTE[idx % PHASE_PALETTE.length];
                        return (
                          <th
                            key={idx}
                            className="px-1.5 py-1.5 text-center font-medium text-muted-foreground"
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <div
                                className="size-2 rounded-full"
                                style={{ backgroundColor: palette.accent }}
                              />
                              <span className="max-w-[60px] truncate">
                                {phase.name || `P${idx + 1}`}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resources.map((resource) => (
                      <tr key={resource.id}>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="size-2.5 shrink-0 rounded"
                              style={{ backgroundColor: resource.color }}
                            />
                            <span className="truncate text-foreground">
                              {resource.short_name || resource.name}
                            </span>
                          </div>
                        </td>
                        {phases.map((phase, phaseIdx) => {
                          const assignment = (phase.resources || []).find(
                            (r) => r.resource_id === resource.id
                          );
                          const mode = assignment?.mode;
                          return (
                            <td key={phaseIdx} className="px-1.5 py-1.5 text-center">
                              <button
                                onClick={() => onCycle(resource.id, phaseIdx)}
                                className={`inline-flex size-6 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                                  mode === "study"
                                    ? "bg-sky-200 text-sky-800"
                                    : mode === "review"
                                      ? "bg-amber-200 text-amber-800"
                                      : "border border-muted-foreground/20 text-muted-foreground/40 hover:border-muted-foreground/40"
                                }`}
                              >
                                {mode === "study" ? "S" : mode === "review" ? "R" : "—"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-muted-foreground">
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
                <span className="flex items-center gap-1">
                  <span className="inline-flex size-3.5 items-center justify-center rounded border border-muted-foreground/20 text-[8px] font-bold text-muted-foreground/40">
                    —
                  </span>{" "}
                  Inactive
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border">
              {estimates.map((est, idx) => {
                const palette = PHASE_PALETTE[idx % PHASE_PALETTE.length];
                const pct =
                  est.total_available_hours > 0
                    ? Math.min(100, (est.total_needed_hours / est.total_available_hours) * 100)
                    : 0;
                return (
                  <div key={idx} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: palette.accent }}
                        />
                        <span className="text-[11px] font-medium text-foreground">
                          {est.phase_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] tabular-nums">
                        <span className="text-muted-foreground">
                          {est.total_needed_hours}h / {est.total_available_hours}h
                        </span>
                        <span
                          className={`font-medium ${surplusColor(est.surplus_hours, est.total_available_hours)}`}
                        >
                          {est.surplus_hours >= 0
                            ? `+${est.surplus_hours}h`
                            : `${est.surplus_hours}h`}
                        </span>
                      </div>
                    </div>
                    {est.total_available_hours > 0 && (
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${surplusBarColor(est.surplus_hours, est.total_available_hours)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
