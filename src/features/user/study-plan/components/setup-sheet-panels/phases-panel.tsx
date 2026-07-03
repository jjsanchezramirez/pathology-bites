"use client";

import { Button } from "@/shared/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import type { PhaseConfig } from "../../lib/types";
import { PHASE_PALETTE } from "../../lib/color-utils";
import { PanelHeader } from "../setup-sheet-parts";
import { fmtRange } from "../setup-sheet-utils";

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
