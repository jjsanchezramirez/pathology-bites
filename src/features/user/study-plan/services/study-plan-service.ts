import { StudyResource, StudyConfig, ScheduleTask } from "../lib/types";

const BASE = "/api/user/study-plan";

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

export const studyPlanService = {
  // Resources
  async getResources(): Promise<StudyResource[]> {
    return apiFetch("/resources");
  },

  async saveResources(resources: StudyResource[]): Promise<void> {
    await apiFetch("/resources", {
      method: "PUT",
      body: JSON.stringify({ resources }),
    });
  },

  // Config
  async getConfig(): Promise<StudyConfig | null> {
    return apiFetch("/config");
  },

  async saveConfig(config: StudyConfig): Promise<void> {
    await apiFetch("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  // Schedule
  async getSchedule(): Promise<ScheduleTask[]> {
    return apiFetch("/schedule");
  },

  async saveSchedule(tasks: ScheduleTask[]): Promise<void> {
    await apiFetch("/schedule", {
      method: "PUT",
      body: JSON.stringify({ tasks }),
    });
  },

  // Progress
  async getProgress(): Promise<{ task_key: string; completed_at: string }[]> {
    return apiFetch("/progress");
  },

  async completeTask(taskKey: string): Promise<void> {
    await apiFetch("/progress", {
      method: "POST",
      body: JSON.stringify({ task_key: taskKey, completed_at: new Date().toISOString() }),
    });
  },

  async uncompleteTask(taskKey: string): Promise<void> {
    await apiFetch(`/progress?task_key=${encodeURIComponent(taskKey)}`, {
      method: "DELETE",
    });
  },

  async clearAllProgress(): Promise<void> {
    await apiFetch(`/progress?all=1`, { method: "DELETE" });
  },
};
