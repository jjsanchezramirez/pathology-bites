"use client";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ChevronRight, BookOpen, ListOrdered } from "lucide-react";
import type { PhaseConfig } from "../../lib/types";
import { PanelHeader } from "../setup-sheet-parts";
import { fmtH, surplusColor, surplusBarColor } from "../setup-sheet-utils";
import type { PhaseEstimate } from "./shared";

export function PhaseDetailPanel({
  phase,
  phaseNumber,
  est,
  subjectCount,
  onUpdatePhase,
  onOpenResources,
  onOpenSubjectOrder,
  onRemove,
  onBack,
}: {
  phase: PhaseConfig;
  phaseNumber: number;
  est?: PhaseEstimate;
  subjectCount: number;
  onUpdatePhase: (updates: Partial<PhaseConfig>) => void;
  onOpenResources: () => void;
  onOpenSubjectOrder: () => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const phaseResAssignments = phase.resources || [];
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={phase.name || `Phase ${phaseNumber}`} onBack={onBack} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input value={phase.name} onChange={(e) => onUpdatePhase({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Start</label>
            <Input
              type="date"
              value={phase.start_date}
              onChange={(e) => onUpdatePhase({ start_date: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">End</label>
            <Input
              type="date"
              value={phase.end_date}
              onChange={(e) => onUpdatePhase({ end_date: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Weekday hours</label>
            <Input
              type="text"
              inputMode="decimal"
              value={phase.daily_minutes_weekday / 60}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v))
                  onUpdatePhase({ daily_minutes_weekday: Math.max(0, (parseFloat(v) || 0) * 60) });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Weekend hours</label>
            <Input
              type="text"
              inputMode="decimal"
              value={phase.daily_minutes_weekend / 60}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v))
                  onUpdatePhase({ daily_minutes_weekend: Math.max(0, (parseFloat(v) || 0) * 60) });
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Catch-up day interval
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={phase.catchup_every}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) onUpdatePhase({ catchup_every: parseInt(v) || 0 });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">First catch-up date</label>
            <Input
              type="date"
              value={phase.catchup_first_date || ""}
              onChange={(e) => onUpdatePhase({ catchup_first_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onOpenResources}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <BookOpen size={16} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Resources</div>
              <div className="text-xs text-muted-foreground">
                {phaseResAssignments.filter((r) => r.mode === "study").length} study ·{" "}
                {phaseResAssignments.filter((r) => r.mode === "review").length} review
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <button
            onClick={onOpenSubjectOrder}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <ListOrdered size={16} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Subject Order</div>
              <div className="text-xs text-muted-foreground">{subjectCount} categories</div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {est && (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {fmtH(
                  est.effective_day_count > 0 ? est.total_needed_hours / est.effective_day_count : 0
                )}{" "}
                daily
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {est.study_day_count} study days
              </span>
            </div>
            <div>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span className="text-muted-foreground">
                  Needed: {fmtH(est.total_needed_hours)}
                </span>
                <span className="text-muted-foreground">
                  Available: {fmtH(est.total_available_hours)}
                </span>
                {est.surplus_hours !== 0 && (
                  <span
                    className={`font-medium tabular-nums ${surplusColor(est.surplus_hours, est.total_available_hours)}`}
                  >
                    {est.surplus_hours > 0 ? "+" : ""}
                    {fmtH(est.surplus_hours)}
                  </span>
                )}
              </div>
              {est.total_available_hours > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${surplusBarColor(est.surplus_hours, est.total_available_hours)}`}
                    style={{
                      width: `${Math.min(100, (est.total_needed_hours / est.total_available_hours) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            {est.resource_hours.length > 0 && (
              <div className="space-y-0.5">
                {est.resource_hours.map((r) => (
                  <div key={r.resource_name} className="flex justify-between text-[11px]">
                    <span className="truncate text-muted-foreground">{r.resource_name}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {fmtH(r.total_hours)}{" "}
                      <span className="text-muted-foreground">({fmtH(r.hours_per_day)} daily)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          Remove Phase
        </Button>
      </div>
    </div>
  );
}
