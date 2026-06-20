"use client";

import { useState, useEffect, useCallback } from "react";
import { LearningSubjectWithCategory } from "../types/lesson";
import { learnService } from "../services/learn-service";
import { log } from "@/shared/utils/logging";

export function useLearningModules() {
  const [subjects, setSubjects] = useState<LearningSubjectWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await learnService.getSubjects();
      setSubjects(data);
    } catch (err) {
      log.error("Failed to load learning modules:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group subjects by category
  const subjectsByCategory = subjects.reduce<
    Record<
      string,
      { category: LearningSubjectWithCategory["category"]; subjects: LearningSubjectWithCategory[] }
    >
  >((acc, subject) => {
    const catId = subject.category_id;
    if (!acc[catId]) {
      acc[catId] = { category: subject.category, subjects: [] };
    }
    acc[catId].subjects.push(subject);
    return acc;
  }, {});

  return {
    subjects,
    subjectsByCategory,
    loading,
    error,
    refresh: load,
  };
}
