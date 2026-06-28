"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet, SheetTrigger, SheetContent } from "@/shared/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Settings,
  Loader2,
  GraduationCap,
  Layers,
  BookOpen,
  CalendarOff,
  Grid3x3,
  ChevronRight,
  Zap,
  ListOrdered,
} from "lucide-react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { StudyResource, StudyConfig, ScheduleTask, PhaseConfig } from "../lib/types";
import { generateSchedule, validateConfig, estimatePhaseHours } from "../lib/scheduler";
import { DaysOffPicker } from "./days-off-picker";
import { ResourceEditPanel } from "./resource-edit-panel";
import { SubjectEditPanel } from "./subject-edit-panel";
import { useDebounce } from "../hooks/use-debounce";
import { CATEGORIES, CP_CATEGORIES, AP_CATEGORIES } from "../lib/categories";
import { studyPlanService } from "../services/study-plan-service";
import { log } from "@/shared/utils/logging";

import { fmtH, orderedSubjectIds, aggregateRebalanceProgress } from "./setup-sheet-utils";
import { PanelHeader } from "./setup-sheet-parts";
import {
  ExamsPanel,
  PhasesPanel,
  ResourcesPanel,
  SubjectOrderPanel,
  ResourceMatrixPanel,
  PhaseResourcesPanel,
} from "./setup-sheet-panels";

interface SetupSheetProps {
  resources: StudyResource[];
  setResources: React.Dispatch<React.SetStateAction<StudyResource[]>>;
  config: StudyConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<StudyConfig | null>>;
  schedule: ScheduleTask[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleTask[]>>;
  completedTasks: Record<string, string>;
  setCompletedTasks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentDate: string;
}

export function SetupSheet({
  resources,
  setResources,
  config,
  setConfig,
  schedule,
  setSchedule,
  completedTasks,
  setCompletedTasks,
  currentDate,
}: SetupSheetProps) {
  type Panel =
    | "menu"
    | "exams"
    | "phases"
    | "phase-detail"
    | "phase-resources"
    | "subject-order"
    | "resources"
    | "resource-edit"
    | "resource-subjects"
    | "daysoff"
    | "resource-matrix";

  const [panel, setPanel] = useState<Panel>("menu");
  const [editingResourceData, setEditingResourceData] = useState<Partial<StudyResource> | null>(
    null
  );
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  const [localConfig, setLocalConfig] = useState<StudyConfig | null>(config);
  const debouncedConfig = useDebounce(localConfig, 800);
  const lastSavedRef = useRef("");

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
      lastSavedRef.current = JSON.stringify(config);
    }
  }, [config]);

  useEffect(() => {
    if (!debouncedConfig) return;
    const json = JSON.stringify(debouncedConfig);
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    setConfig(debouncedConfig);
    studyPlanService
      .saveConfig(debouncedConfig)
      .catch((err) => log.error("Failed to save config:", err));
  }, [debouncedConfig, setConfig]);

  // Flush any pending config save synchronously — the debounced useEffect
  // only fires on idle, so Generate/Rebalance clicked within 800ms of an edit
  // would otherwise upsert a schedule against a config the DB hasn't seen.
  const flushConfig = useCallback(
    async (cfg: StudyConfig) => {
      const json = JSON.stringify(cfg);
      if (json === lastSavedRef.current) return;
      lastSavedRef.current = json;
      setConfig(cfg);
      await studyPlanService.saveConfig(cfg);
    },
    [setConfig]
  );

  const updateConfig = useCallback((updates: Partial<StudyConfig>) => {
    setLocalConfig((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const goTo = useCallback((p: Panel) => {
    setAnimDir("forward");
    setPanel(p);
  }, []);

  const goBack = useCallback((p: Panel = "menu") => {
    setAnimDir("back");
    setPanel(p);
  }, []);

  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"generate" | "rebalance" | null>(null);
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const saveResource = async (resource: StudyResource) => {
    try {
      const updated = resources.some((r) => r.id === resource.id)
        ? resources.map((r) => (r.id === resource.id ? resource : r))
        : [...resources, resource];
      setResources(updated);
      await studyPlanService.saveResources(updated);
    } catch (e) {
      log.error("Failed to save resource:", e);
    }
  };

  const deleteResource = async (id: string) => {
    try {
      const updated = resources.filter((r) => r.id !== id);
      setResources(updated);
      await studyPlanService.saveResources(updated);
    } catch (e) {
      log.error("Failed to delete resource:", e);
    }
  };

  const generateFull = async () => {
    if (!localConfig) return;
    const errs = validateConfig(resources, localConfig);
    if (errs.length > 0) {
      setErrors(errs.map((e) => e.message));
      return;
    }
    setErrors([]);
    setSuccessMsg(null);
    setGenerating(true);
    try {
      await flushConfig(localConfig);
      const { tasks: newSched, warnings } = generateSchedule(resources, localConfig);
      if (warnings.length > 0) log.warn("Schedule warnings:", warnings);
      await studyPlanService.saveSchedule(newSched);
      // Generate is "wipe clean" — progress must be cleared in the DB too,
      // not just in local state, or a reload will resurrect completions.
      await studyPlanService.clearAllProgress();
      setSchedule(newSched);
      setCompletedTasks({});
      setSuccessMsg("Schedule generated successfully");
    } catch (e) {
      log.error("Failed to generate:", e);
      setErrors(["Something went wrong saving your schedule. Try again in a bit."]);
    } finally {
      setGenerating(false);
    }
  };

  const rebalance = async () => {
    if (!localConfig) {
      log.warn("Rebalance: no config");
      return;
    }
    const errs = validateConfig(resources, localConfig);
    if (errs.length > 0) {
      setErrors(errs.map((e) => e.message));
      log.warn("Rebalance validation errors:", errs);
      return;
    }
    setErrors([]);
    setSuccessMsg(null);
    setGenerating(true);
    try {
      await flushConfig(localConfig);

      // Aggregate completed units per resource_id::subject_id so the scheduler
      // can skip work already done. Past dates are excluded from the new
      // schedule by passing currentDate as effectiveStart. Pre-migration rows
      // may be missing resource_id or subject_id; recover by looking up the
      // current resource/subject by name.
      const progress = aggregateRebalanceProgress(schedule, completedTasks, resources);

      const { tasks: newSched } = generateSchedule(resources, localConfig, progress, currentDate);

      // Local state: keep old rows that survive (completed tasks outside the
      // new schedule's date range) plus everything new.
      const newIds = new Set(newSched.map((t) => t.task_id));
      const kept = schedule.filter(
        (t) => t.task_type === "task" && !newIds.has(t.task_id) && !!completedTasks[t.task_id]
      );
      const merged = [...kept, ...newSched];
      await studyPlanService.saveSchedule(merged);
      setSchedule(merged);
      setSuccessMsg("Schedule rebalanced successfully");
    } catch (e) {
      log.error("Failed to rebalance:", e);
      setErrors(["Something went wrong saving your schedule. Try again in a bit."]);
    } finally {
      setGenerating(false);
    }
  };

  const variants = useMemo(
    () => ({
      enter: (dir: "forward" | "back") => ({
        x: dir === "forward" ? 80 : -80,
        opacity: 0,
      }),
      center: { x: 0, opacity: 1 },
      exit: (dir: "forward" | "back") => ({
        x: dir === "forward" ? -80 : 80,
        opacity: 0,
      }),
    }),
    []
  );

  // Hoisted to top level so hook count is stable across panel switches (rules of hooks).
  const resourceDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!localConfig) return null;

  const updatePhase = (idx: number, updates: Partial<PhaseConfig>) => {
    const phases = [...localConfig.phases];
    phases[idx] = { ...phases[idx], ...updates };
    updateConfig({ phases });
  };

  const renderPanel = () => {
    if (panel === "menu") {
      const menuItems: { key: Panel; icon: typeof GraduationCap; label: string; detail: string }[] =
        [
          {
            key: "exams",
            icon: GraduationCap,
            label: "Exam Dates",
            detail: `${localConfig.exam_dates?.length || 0} exams`,
          },
          {
            key: "phases",
            icon: Layers,
            label: "Phases",
            detail: `${localConfig.phases?.length || 0} phases`,
          },
          {
            key: "resource-matrix",
            icon: Grid3x3,
            label: "Resource Matrix",
            detail: `${resources.length} resources · ${localConfig.phases?.length || 0} phases`,
          },
          {
            key: "resources",
            icon: BookOpen,
            label: "Resources",
            detail: `${resources.length} resources`,
          },
          {
            key: "daysoff",
            icon: CalendarOff,
            label: "Days Off",
            detail: (() => {
              const offs = Object.values(localConfig.days_off || {});
              const full = offs.filter((v) => v === "full").length;
              const half = offs.filter((v) => v === "half").length;
              const parts: string[] = [];
              if (full > 0) parts.push(`${full} days off`);
              if (half > 0) parts.push(`${half} half-days off`);
              return parts.length > 0 ? parts.join(" · ") : "None";
            })(),
          },
        ];

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
                  onClick={() => goTo(key)}
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

            {localConfig.phases.length > 0 &&
              resources.length > 0 &&
              (() => {
                const ests = estimatePhaseHours(resources, localConfig);
                const maxAvgDaily = Math.max(
                  ...ests.map((e) =>
                    e.effective_day_count > 0 ? e.total_needed_hours / e.effective_day_count : 0
                  ),
                  0
                );

                return (
                  <div className="space-y-1.5">
                    {ests.map((e) => {
                      const avgDaily =
                        e.effective_day_count > 0
                          ? e.total_needed_hours / e.effective_day_count
                          : 0;
                      const pct =
                        e.total_available_hours > 0
                          ? Math.min(100, (e.total_needed_hours / e.total_available_hours) * 100)
                          : 0;
                      const ratio =
                        e.total_available_hours > 0 ? e.surplus_hours / e.total_available_hours : 0;
                      const barColor =
                        ratio >= -0.05
                          ? "bg-emerald-300"
                          : ratio >= -0.15
                            ? "bg-amber-300"
                            : "bg-destructive";
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
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {schedule.length > 0 &&
                      (() => {
                        const totalMin = schedule.reduce((s, t) => s + t.minutes, 0);
                        const h = Math.floor(totalMin / 60);
                        const m = totalMin % 60;
                        const time = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h${m}m`;
                        return (
                          <div className="text-xs text-muted-foreground">
                            {schedule.length} tasks · {time}
                          </div>
                        );
                      })()}

                    {(() => {
                      const h = Math.ceil(maxAvgDaily);
                      if (h > 24)
                        return (
                          <p className="border-l-2 border-muted-foreground/30 pl-2.5 text-xs italic text-muted-foreground">
                            Fun fact: the Earth completes one full rotation in 24 hours, not {h}h.
                            Unless you&apos;ve discovered a new planet?
                          </p>
                        );
                      if (h > 16)
                        return (
                          <p className="border-l-2 border-muted-foreground/30 pl-2.5 text-xs italic text-muted-foreground">
                            {h}h daily of studying? Sleep is not a luxury, it&apos;s when your brain
                            consolidates memories. You need those.
                          </p>
                        );
                      if (h > 12)
                        return (
                          <p className="border-l-2 border-muted-foreground/30 pl-2.5 text-xs italic text-muted-foreground">
                            {h}h daily? Bold strategy. Your attention span checked out around hour
                            6, but sure.
                          </p>
                        );
                      if (h > 8)
                        return (
                          <p className="border-l-2 border-muted-foreground/30 pl-2.5 text-xs italic text-muted-foreground">
                            {h}h daily? That&apos;s a full work day plus overtime. Don&apos;t forget
                            to eat, stretch, and see sunlight.
                          </p>
                        );
                      return null;
                    })()}
                  </div>
                );
              })()}

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setConfirmAction("generate")}
                disabled={generating}
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}{" "}
                Generate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmAction("rebalance")}
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

    if (panel === "exams") {
      return (
        <ExamsPanel
          examDates={localConfig.exam_dates || []}
          onChange={(exams) => updateConfig({ exam_dates: exams })}
          onBack={() => goBack("menu")}
        />
      );
    }

    if (panel === "phases") {
      return (
        <PhasesPanel
          phases={localConfig.phases || []}
          onOpenPhase={(idx) => {
            setActivePhaseIdx(idx);
            goTo("phase-detail");
          }}
          onAddPhase={() => {
            const phases = localConfig.phases || [];
            const newPhase: PhaseConfig = {
              name: `Phase ${phases.length + 1}`,
              start_date: new Date().toISOString().split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
              daily_minutes_weekday: 480,
              daily_minutes_weekend: 480,
              catchup_every: 0,
              subject_order: [...CP_CATEGORIES.map((c) => c.id), ...AP_CATEGORIES.map((c) => c.id)],
              resources: [],
            };
            updateConfig({ phases: [...phases, newPhase] });
          }}
          onBack={() => goBack("menu")}
        />
      );
    }

    if (panel === "resource-matrix") {
      const matrixPhases = localConfig.phases || [];
      const matrixEstimates =
        matrixPhases.length > 0 && resources.length > 0
          ? estimatePhaseHours(resources, localConfig)
          : [];
      const matrixCycle = (resId: string, phaseIdx: number) => {
        const phase = matrixPhases[phaseIdx];
        const assignments = phase.resources || [];
        const existing = assignments.find((r) => r.resource_id === resId);
        let updated;
        if (!existing) {
          updated = [...assignments, { resource_id: resId, mode: "study" as const }];
        } else if (existing.mode === "study") {
          updated = assignments.map((r) =>
            r.resource_id === resId ? { ...r, mode: "review" as const, review_pct: 50 } : r
          );
        } else {
          updated = assignments.filter((r) => r.resource_id !== resId);
        }
        updatePhase(phaseIdx, { resources: updated });
      };
      return (
        <ResourceMatrixPanel
          phases={matrixPhases}
          resources={resources}
          estimates={matrixEstimates}
          onCycle={matrixCycle}
          onBack={() => goBack("menu")}
        />
      );
    }

    if (panel === "phase-detail") {
      const phase = localConfig.phases[activePhaseIdx];
      if (!phase) {
        setPanel("phases");
        return null;
      }

      const phaseResAssignments = phase.resources || [];
      const canonicalAllIds = [
        ...CP_CATEGORIES.map((c) => c.id),
        ...AP_CATEGORIES.map((c) => c.id),
      ];
      const savedOrder = phase.subject_order || [];
      const subjectIds = [
        ...savedOrder.filter((id) => canonicalAllIds.includes(id)),
        ...canonicalAllIds.filter((id) => !savedOrder.includes(id)),
      ];

      const estimates = estimatePhaseHours(resources, localConfig);
      const est = estimates[activePhaseIdx];

      return (
        <div className="flex h-full flex-col">
          <PanelHeader
            title={phase.name || `Phase ${activePhaseIdx + 1}`}
            onBack={() => goBack("phases")}
          />
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Name</label>
              <Input
                value={phase.name}
                onChange={(e) => updatePhase(activePhaseIdx, { name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Start</label>
                <Input
                  type="date"
                  value={phase.start_date}
                  onChange={(e) => updatePhase(activePhaseIdx, { start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">End</label>
                <Input
                  type="date"
                  value={phase.end_date}
                  onChange={(e) => updatePhase(activePhaseIdx, { end_date: e.target.value })}
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
                      updatePhase(activePhaseIdx, {
                        daily_minutes_weekday: Math.max(0, (parseFloat(v) || 0) * 60),
                      });
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
                      updatePhase(activePhaseIdx, {
                        daily_minutes_weekend: Math.max(0, (parseFloat(v) || 0) * 60),
                      });
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
                    if (v === "" || /^\d+$/.test(v))
                      updatePhase(activePhaseIdx, { catchup_every: parseInt(v) || 0 });
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  First catch-up date
                </label>
                <Input
                  type="date"
                  value={phase.catchup_first_date || ""}
                  onChange={(e) =>
                    updatePhase(activePhaseIdx, { catchup_first_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => goTo("phase-resources")}
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
                onClick={() => {
                  if (!phase.subject_order?.length) {
                    updatePhase(activePhaseIdx, { subject_order: subjectIds });
                  }
                  goTo("subject-order");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <ListOrdered size={16} className="text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">Subject Order</div>
                  <div className="text-xs text-muted-foreground">
                    {subjectIds.length} categories
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>

            {est &&
              (() => {
                const avgDaily =
                  est.effective_day_count > 0
                    ? est.total_needed_hours / est.effective_day_count
                    : 0;
                const ratio =
                  est.total_available_hours > 0 ? est.surplus_hours / est.total_available_hours : 0;
                const diffCls =
                  ratio >= -0.05
                    ? "text-emerald-500"
                    : ratio >= -0.15
                      ? "text-amber-400"
                      : "text-destructive";
                const barCls =
                  ratio >= -0.05
                    ? "bg-emerald-300"
                    : ratio >= -0.15
                      ? "bg-amber-300"
                      : "bg-destructive";
                return (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {fmtH(avgDaily)} daily
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
                          <span className={`font-medium tabular-nums ${diffCls}`}>
                            {est.surplus_hours > 0 ? "+" : ""}
                            {fmtH(est.surplus_hours)}
                          </span>
                        )}
                      </div>
                      {est.total_available_hours > 0 && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${barCls}`}
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
                            <span className="truncate text-muted-foreground">
                              {r.resource_name}
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground">
                              {fmtH(r.total_hours)}{" "}
                              <span className="text-muted-foreground">
                                ({fmtH(r.hours_per_day)} daily)
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Remove ${phase.name}?`)) {
                  updateConfig({
                    phases: localConfig.phases.filter((_, i) => i !== activePhaseIdx),
                  });
                  goBack("phases");
                }
              }}
            >
              Remove Phase
            </Button>
          </div>
        </div>
      );
    }

    if (panel === "phase-resources") {
      const phase = localConfig.phases[activePhaseIdx];
      if (!phase) {
        setPanel("phases");
        return null;
      }
      return (
        <PhaseResourcesPanel
          phaseName={phase.name}
          assignments={phase.resources || []}
          resources={resources}
          sensors={resourceDragSensors}
          onAssignmentsChange={(next) => updatePhase(activePhaseIdx, { resources: next })}
          onBack={() => goBack("phase-detail")}
        />
      );
    }

    if (panel === "subject-order") {
      const phase = localConfig.phases[activePhaseIdx];
      if (!phase) {
        setPanel("phases");
        return null;
      }
      const canonicalAllIds = [
        ...CP_CATEGORIES.map((c) => c.id),
        ...AP_CATEGORIES.map((c) => c.id),
      ];
      const items = orderedSubjectIds(phase.subject_order || [], canonicalAllIds);
      const labelMap: Record<string, string> = {};
      for (const c of CATEGORIES) labelMap[c.id] = c.name;
      return (
        <SubjectOrderPanel
          phaseName={phase.name}
          items={items}
          labelMap={labelMap}
          onChange={(next) => updatePhase(activePhaseIdx, { subject_order: next })}
          onBack={() => goBack("phase-detail")}
        />
      );
    }

    if (panel === "resources") {
      return (
        <ResourcesPanel
          resources={resources}
          onEditResource={(resource) => {
            setEditingResourceData({ ...resource });
            goTo("resource-edit");
          }}
          onAddResource={() => {
            setEditingResourceData({
              id: crypto.randomUUID(),
              name: "",
              short_name: "",
              type: "book",
              color: "#4A90D9",
              subjects: [],
              pace: 10,
            });
            goTo("resource-edit");
          }}
          onBack={() => goBack("menu")}
        />
      );
    }

    if (panel === "resource-edit" && editingResourceData) {
      return (
        <div className="h-full">
          <ResourceEditPanel
            initial={editingResourceData}
            onSave={async (r) => {
              await saveResource(r);
              goBack("resources");
            }}
            onBack={() => goBack("resources")}
            onDelete={
              editingResourceData.id && editingResourceData.name
                ? async () => {
                    await deleteResource(editingResourceData.id!);
                    goBack("resources");
                  }
                : undefined
            }
            onEditSubjects={(form) => {
              setEditingResourceData(form);
              goTo("resource-subjects");
            }}
          />
        </div>
      );
    }

    if (panel === "resource-subjects" && editingResourceData) {
      return (
        <div className="h-full">
          <SubjectEditPanel
            subjects={editingResourceData.subjects || []}
            resourceType={editingResourceData.type || "book"}
            resourceName={editingResourceData.name || "Resource"}
            onSave={(subjects) => {
              setEditingResourceData({ ...editingResourceData, subjects });
              goBack("resource-edit");
            }}
            onBack={() => goBack("resource-edit")}
          />
        </div>
      );
    }

    if (panel === "daysoff") {
      return (
        <div className="flex h-full flex-col">
          <PanelHeader title="Days Off" onBack={() => goBack("menu")} />
          <div className="flex-1 overflow-y-auto p-4">
            <DaysOffPicker
              daysOff={localConfig.days_off || {}}
              onChange={(daysOff) => updateConfig({ days_off: daysOff })}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Sheet
        onOpenChange={() => {
          setPanel("menu");
          setErrors([]);
          setSuccessMsg(null);
        }}
      >
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings size={16} />
            <span className="hidden sm:inline text-xs">Edit Plan</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton={panel === "menu"}
          className="w-[85%] max-w-[22rem] overflow-hidden bg-card p-0 sm:max-w-sm"
        >
          <AnimatePresence mode="popLayout" custom={animDir}>
            <motion.div
              key={panel}
              custom={animDir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "generate" ? "Generate a new schedule?" : "Rebalance from today?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "generate"
                ? "This will erase all existing progress and create a fresh schedule from your phases and resources."
                : "Past completed work is kept; everything from today onward will be regenerated to reflect your current resources and phases."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === "generate" ? "destructive" : "default"}
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "generate") generateFull();
                else if (action === "rebalance") rebalance();
              }}
            >
              {confirmAction === "generate" ? "Generate" : "Rebalance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
