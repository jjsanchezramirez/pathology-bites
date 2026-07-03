"use client";

import { Button } from "@/shared/components/ui/button";
import {
  ChevronRight,
  Loader2,
  Zap,
  GraduationCap,
  Layers,
  Grid3x3,
  BookOpen,
  CalendarOff,
} from "lucide-react";
import {
  fmtH,
  surplusBarColor,
  daysOffSummary,
  formatTotalTime,
  overloadMessage,
} from "../setup-sheet-utils";
import type { PhaseEstimate } from "./shared";

type MenuNavKey = "exams" | "phases" | "resource-matrix" | "resources" | "daysoff";

export function MenuPanel({
  examCount,
  phaseCount,
  resourceCount,
  daysOff,
  estimates,
  hasResources,
  scheduleTaskCount,
  scheduleTotalMinutes,
  errors,
  successMsg,
  generating,
  onNavigate,
  onGenerate,
  onRebalance,
}: {
  examCount: number;
  phaseCount: number;
  resourceCount: number;
  daysOff: Record<string, string> | undefined;
  estimates: PhaseEstimate[];
  hasResources: boolean;
  scheduleTaskCount: number;
  scheduleTotalMinutes: number;
  errors: string[];
  successMsg: string | null;
  generating: boolean;
  onNavigate: (key: MenuNavKey) => void;
  onGenerate: () => void;
  onRebalance: () => void;
}) {
  const menuItems: {
    key: MenuNavKey;
    icon: typeof GraduationCap;
    label: string;
    detail: string;
  }[] = [
    { key: "exams", icon: GraduationCap, label: "Exam Dates", detail: `${examCount} exams` },
    { key: "phases", icon: Layers, label: "Phases", detail: `${phaseCount} phases` },
    {
      key: "resource-matrix",
      icon: Grid3x3,
      label: "Resource Matrix",
      detail: `${resourceCount} resources · ${phaseCount} phases`,
    },
    { key: "resources", icon: BookOpen, label: "Resources", detail: `${resourceCount} resources` },
    { key: "daysoff", icon: CalendarOff, label: "Days Off", detail: daysOffSummary(daysOff) },
  ];

  const maxAvgDaily = Math.max(
    ...estimates.map((e) =>
      e.effective_day_count > 0 ? e.total_needed_hours / e.effective_day_count : 0
    ),
    0
  );
  const overload = overloadMessage(maxAvgDaily);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-foreground">Edit Plan</h2>
        <p className="text-xs text-muted-foreground">Configure your study plan</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {menuItems.map(({ key, icon: Icon, label, detail }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <Icon size={18} className="shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{detail}</div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {errors.length > 0 && (
          <div className="rounded-xl bg-destructive/10 p-2.5 space-y-0.5">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">
                {e}
              </p>
            ))}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl bg-emerald-500/10 p-2.5">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{successMsg}</p>
          </div>
        )}

        {phaseCount > 0 && hasResources && (
          <div className="space-y-1.5">
            {estimates.map((e) => {
              const avgDaily =
                e.effective_day_count > 0 ? e.total_needed_hours / e.effective_day_count : 0;
              const pct =
                e.total_available_hours > 0
                  ? Math.min(100, (e.total_needed_hours / e.total_available_hours) * 100)
                  : 0;
              return (
                <div key={e.phase_index}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{e.phase_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtH(avgDaily)} daily
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${surplusBarColor(e.surplus_hours, e.total_available_hours)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {scheduleTaskCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {scheduleTaskCount} tasks · {formatTotalTime(scheduleTotalMinutes)}
              </div>
            )}

            {overload && (
              <p className="border-l-2 border-muted-foreground/30 pl-2.5 text-xs italic text-muted-foreground">
                {overload}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}{" "}
            Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onRebalance}
            disabled={generating}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}{" "}
            Rebalance
          </Button>
        </div>
      </div>
    </div>
  );
}
