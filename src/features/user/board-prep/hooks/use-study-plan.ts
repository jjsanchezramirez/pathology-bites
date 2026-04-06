"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { StudyResource, StudyConfig, ScheduleTask } from "../lib/types";
import { buildColorMap } from "../lib/color-utils";
import { boardPrepService } from "../services/board-prep-service";

export interface CompletionData {
  [taskKey: string]: string;
}

export function useStudyPlan() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [schedule, setSchedule] = useState<ScheduleTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletionData>({});

  // Full load on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [resData, cfgData, progData, schedData] = await Promise.all([
          boardPrepService.getResources(),
          boardPrepService.getConfig(),
          boardPrepService.getProgress(),
          boardPrepService.getSchedule(),
        ]);

        setResources(resData);
        if (cfgData) {
          setConfig(cfgData);
        } else {
          setConfig({
            id: "default",
            exam_dates: [],
            days_off: {},
            recurring_off: [],
            phases: [],
          });
        }

        const completionMap: CompletionData = {};
        progData.forEach((p) => { completionMap[p.task_key] = p.completed_at; });
        setCompletedTasks(completionMap);
        setSchedule(schedData);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err instanceof Error ? err.message : "Failed to load study data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Re-sync progress when tab/app becomes visible again
  useEffect(() => {
    const syncProgress = async () => {
      try {
        const progData = await boardPrepService.getProgress();
        const completionMap: CompletionData = {};
        progData.forEach((p) => { completionMap[p.task_key] = p.completed_at; });
        setCompletedTasks(completionMap);
      } catch {
        // Silent fail — stale data is acceptable until next sync
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncProgress();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const colorMap = useMemo(() => buildColorMap(resources), [resources]);

  const toggleTask = useCallback(
    async (taskId: string) => {
      const isNowCompleted = !completedTasks[taskId];

      setCompletedTasks((prev) => {
        const next = { ...prev };
        if (isNowCompleted) {
          next[taskId] = new Date().toISOString();
        } else {
          delete next[taskId];
        }
        return next;
      });

      try {
        if (isNowCompleted) {
          await boardPrepService.completeTask(taskId);
        } else {
          await boardPrepService.uncompleteTask(taskId);
        }
      } catch (err) {
        console.error("Failed to update task:", err);
        // Revert optimistic update
        setCompletedTasks((prev) => {
          const next = { ...prev };
          if (isNowCompleted) {
            delete next[taskId];
          } else {
            next[taskId] = new Date().toISOString();
          }
          return next;
        });
      }
    },
    [completedTasks]
  );

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    window.location.reload();
  }, []);

  return {
    loading, error, retry,
    resources, setResources,
    config, setConfig,
    schedule, setSchedule,
    completedTasks, setCompletedTasks,
    colorMap, toggleTask,
  };
}
