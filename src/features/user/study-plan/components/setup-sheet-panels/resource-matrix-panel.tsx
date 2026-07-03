"use client";

import type { StudyResource, PhaseConfig } from "../../lib/types";
import { PHASE_PALETTE } from "../../lib/color-utils";
import { PanelHeader } from "../setup-sheet-parts";
import { surplusColor, surplusBarColor } from "../setup-sheet-utils";
import type { PhaseEstimate } from "./shared";

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
