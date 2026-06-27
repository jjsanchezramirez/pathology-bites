// Pure helpers + shared types for the My Questions page.
// Extracted from page.tsx so the filtering, tab-selection, age, and review/flag
// data-merge logic are unit-testable in isolation (see my-questions-utils.test.ts).

import { QuestionWithDetails } from "@/shared/types/questions";

export interface MyQuestion extends QuestionWithDetails {
  creator_name?: string;
  resubmission_notes?: string;
  resubmission_date?: string;
  flag_info?: {
    flag_type: string;
    description: string | null;
    flagged_by_name: string;
    created_at: string;
  };
}

const TAB_STATUS: Record<string, string> = {
  revision: "rejected",
  flagged: "flagged",
  drafts: "draft",
  "under-review": "pending_review",
  published: "published",
};

/** Tab + search + difficulty filtering applied to the loaded questions. */
export function filterQuestions(
  questions: MyQuestion[],
  opts: { activeTab: string; searchTerm: string; difficultyFilter: string }
): MyQuestion[] {
  const { activeTab, searchTerm, difficultyFilter } = opts;
  let filtered = questions;

  const status = TAB_STATUS[activeTab];
  if (status) {
    filtered = filtered.filter((q) => q.status === status);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (q) => q.title.toLowerCase().includes(term) || q.stem.toLowerCase().includes(term)
    );
  }

  if (difficultyFilter !== "all") {
    filtered = filtered.filter((q) => q.difficulty?.toLowerCase() === difficultyFilter);
  }

  return filtered;
}

/** Column span for the table's full-width rows (empty state / feedback), per tab. */
export function getColSpan(activeTab: string): number {
  if (activeTab === "drafts") return 3; // checkbox + Question + Actions
  if (activeTab === "published") return 3; // Question + Version + Actions
  return 2; // Question + Actions
}

/** Age tier for a question's last-updated time: "urgent" (>7d), "aging" (>3d), or null. */
export function getAgeTier(updatedAt: string): "urgent" | "aging" | null {
  const daysOld = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOld > 7) return "urgent";
  if (daysOld > 3) return "aging";
  return null;
}

/** First tab (by priority) that has at least one question; falls back to "revision". */
export function pickInitialTab(questions: MyQuestion[]): string {
  const tabPriority: { tab: string; status: string }[] = [
    { tab: "revision", status: "rejected" },
    { tab: "flagged", status: "flagged" },
    { tab: "drafts", status: "draft" },
    { tab: "under-review", status: "pending_review" },
    { tab: "published", status: "published" },
  ];
  const firstNonEmpty = tabPriority.find(({ status }) =>
    questions.some((q) => q.status === status)
  );
  return firstNonEmpty?.tab || "revision";
}

type ReviewRow = {
  question_id: string;
  changes_made?: { resubmission_notes?: string };
  created_at: string;
};
type FlagRow = {
  question_id: string;
  flag_type: string;
  description: string | null;
  created_at: string;
  flagged_by_user?: { first_name: string; last_name: string } | null;
};

/**
 * Merge the batch-fetched resubmission reviews + open flags into the questions.
 * Rows are expected pre-ordered created_at desc; the first row per question wins.
 * Review/flag rows are loosely typed (supabase generics vary) and cast on read.
 */
export function buildMyQuestions(
  data: Record<string, unknown>[] | null,
  reviewsData: Record<string, unknown>[] | null,
  flagsData: Record<string, unknown>[] | null
): MyQuestion[] {
  const notesByQuestion = new Map<
    string,
    { resubmission_notes: string | null; resubmission_date: string }
  >();
  for (const raw of reviewsData || []) {
    const row = raw as unknown as ReviewRow;
    if (!notesByQuestion.has(row.question_id)) {
      notesByQuestion.set(row.question_id, {
        resubmission_notes: row.changes_made?.resubmission_notes ?? null,
        resubmission_date: row.created_at,
      });
    }
  }

  const flagsByQuestion = new Map<
    string,
    { flag_type: string; description: string | null; flagged_by_name: string; created_at: string }
  >();
  for (const raw of flagsData || []) {
    const row = raw as unknown as FlagRow;
    if (flagsByQuestion.has(row.question_id)) continue;
    const flaggedByUser = row.flagged_by_user;
    flagsByQuestion.set(row.question_id, {
      flag_type: row.flag_type,
      description: row.description,
      flagged_by_name: flaggedByUser
        ? `${flaggedByUser.first_name} ${flaggedByUser.last_name}`
        : "Unknown",
      created_at: row.created_at,
    });
  }

  return (data || []).map((q) => ({
    ...q,
    ...(notesByQuestion.get(q.id as string) ?? {}),
    flag_info: flagsByQuestion.get(q.id as string),
  })) as unknown as MyQuestion[];
}
