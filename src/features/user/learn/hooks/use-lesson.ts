"use client";

import { useState, useEffect, useCallback } from "react";
import { LessonWithProgress } from "../types/lesson";
import { learnService } from "../services/learn-service";

export function useLesson(lessonId: string | null) {
  const [lesson, setLesson] = useState<LessonWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lessonId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await learnService.getLesson(lessonId);
      setLesson(data);
    } catch (err) {
      console.error("Failed to load lesson:", err);
      setError(err instanceof Error ? err.message : "Failed to load lesson");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const markComplete = useCallback(
    async (quizScore?: number) => {
      if (!lessonId) return;
      try {
        await learnService.markComplete(lessonId, quizScore);
        // Update local state
        setLesson((prev) =>
          prev
            ? {
                ...prev,
                progress: {
                  ...(prev.progress || {
                    id: "",
                    user_id: "",
                    lesson_id: lessonId,
                    last_accessed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                  }),
                  completed_at: new Date().toISOString(),
                  quiz_score: quizScore ?? prev.progress?.quiz_score ?? null,
                },
              }
            : null
        );
      } catch (err) {
        console.error("Failed to mark lesson complete:", err);
        throw err;
      }
    },
    [lessonId]
  );

  return {
    lesson,
    loading,
    error,
    refresh: load,
    markComplete,
  };
}
