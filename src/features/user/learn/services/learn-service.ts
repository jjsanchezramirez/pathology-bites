import {
  LearningSubjectWithCategory,
  LessonSummary,
  LessonWithProgress,
  UserLessonProgress,
} from "../types/lesson";

const BASE = "/api/user/learn";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${options?.method || "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

export const learnService = {
  async getSubjects(categoryId?: string): Promise<LearningSubjectWithCategory[]> {
    const params = categoryId ? `?category_id=${categoryId}` : "";
    return apiFetch(`/subjects${params}`);
  },

  async getSubject(slug: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    slug: string;
    category: { id: string; name: string; color: string | null; short_form: string | null };
    lessons: LessonSummary[];
  }> {
    return apiFetch(`/subjects/${slug}`);
  },

  async getLesson(id: string): Promise<LessonWithProgress> {
    return apiFetch(`/lessons/${id}`);
  },

  async getProgress(): Promise<UserLessonProgress[]> {
    return apiFetch("/progress");
  },

  async markComplete(lessonId: string, quizScore?: number): Promise<void> {
    await apiFetch("/progress", {
      method: "POST",
      body: JSON.stringify({
        lesson_id: lessonId,
        completed: true,
        quiz_score: quizScore ?? null,
      }),
    });
  },
};
