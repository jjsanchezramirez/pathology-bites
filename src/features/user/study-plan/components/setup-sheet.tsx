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
import { Settings } from "lucide-react";
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

import { orderedSubjectIds, aggregateRebalanceProgress } from "./setup-sheet-utils";
import { PanelHeader } from "./setup-sheet-parts";
import {
  MenuPanel,
  PhaseDetailPanel,
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
      return (
        <MenuPanel
          examCount={localConfig.exam_dates?.length || 0}
          phaseCount={localConfig.phases?.length || 0}
          resourceCount={resources.length}
          daysOff={localConfig.days_off}
          estimates={
            localConfig.phases.length > 0 && resources.length > 0
              ? estimatePhaseHours(resources, localConfig)
              : []
          }
          hasResources={resources.length > 0}
          scheduleTaskCount={schedule.length}
          scheduleTotalMinutes={schedule.reduce((sum, t) => sum + t.minutes, 0)}
          errors={errors}
          successMsg={successMsg}
          generating={generating}
          onNavigate={goTo}
          onGenerate={() => setConfirmAction("generate")}
          onRebalance={() => setConfirmAction("rebalance")}
        />
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
      const canonicalAllIds = [
        ...CP_CATEGORIES.map((c) => c.id),
        ...AP_CATEGORIES.map((c) => c.id),
      ];
      const subjectIds = orderedSubjectIds(phase.subject_order || [], canonicalAllIds);
      const est = estimatePhaseHours(resources, localConfig)[activePhaseIdx];
      return (
        <PhaseDetailPanel
          phase={phase}
          phaseNumber={activePhaseIdx + 1}
          est={est}
          subjectCount={subjectIds.length}
          onUpdatePhase={(updates) => updatePhase(activePhaseIdx, updates)}
          onOpenResources={() => goTo("phase-resources")}
          onOpenSubjectOrder={() => {
            if (!phase.subject_order?.length) {
              updatePhase(activePhaseIdx, { subject_order: subjectIds });
            }
            goTo("subject-order");
          }}
          onRemove={() => {
            if (confirm(`Remove ${phase.name}?`)) {
              updateConfig({ phases: localConfig.phases.filter((_, i) => i !== activePhaseIdx) });
              goBack("phases");
            }
          }}
          onBack={() => goBack("phases")}
        />
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
