import { LearningSubject, Lesson } from "@/features/user/learn/types/lesson";

const BASE = "/api/admin/learn";

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

export const adminLearnService = {
  // Subjects
  async getSubjects(): Promise<
    (LearningSubject & {
      category: { id: string; name: string; color: string | null; short_form: string | null };
      lesson_count: number;
    })[]
  > {
    return apiFetch("/subjects");
  },

  async createSubject(data: {
    title: string;
    description?: string;
    slug: string;
    category_id: string;
    cover_image_url?: string;
    sort_order?: number;
    status?: string;
  }): Promise<LearningSubject> {
    return apiFetch("/subjects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSubject(id: string, data: Partial<LearningSubject>): Promise<LearningSubject> {
    return apiFetch(`/subjects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteSubject(id: string): Promise<void> {
    await apiFetch(`/subjects/${id}`, { method: "DELETE" });
  },

  // Lessons
  async getLessons(
    subjectId?: string
  ): Promise<(Lesson & { subject: { id: string; title: string; slug: string } })[]> {
    const params = subjectId ? `?subject_id=${subjectId}` : "";
    return apiFetch(`/lessons${params}`);
  },

  async getLesson(
    id: string
  ): Promise<Lesson & { subject: { id: string; title: string; slug: string } }> {
    return apiFetch(`/lessons/${id}`);
  },

  async createLesson(data: {
    subject_id: string;
    title: string;
    slug: string;
    description?: string | null;
    content?: unknown;
    content_markdown?: string | null;
    quiz?: unknown;
    anki_deck_ref?: string | null;
    cover_image_url?: string;
    sort_order?: number;
    estimated_minutes?: number | null;
    status?: string;
  }): Promise<Lesson> {
    return apiFetch("/lessons", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateLesson(
    id: string,
    data: Partial<Lesson> & {
      content_markdown?: string | null;
      quiz?: unknown;
      anki_deck_ref?: string | null;
    }
  ): Promise<Lesson> {
    return apiFetch(`/lessons/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteLesson(id: string): Promise<void> {
    await apiFetch(`/lessons/${id}`, { method: "DELETE" });
  },
};
