// Pure helpers + shared types/config for the users table UI.
// Extracted from users-table.tsx so the display-name, type-label, and pagination
// logic are unit-testable in isolation (see users-table-utils.test.ts).

export interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  /** Granted permissions (admins implicitly hold all). */
  permissions: string[];
  user_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  institution: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  quizzes_completed: number;
  quizzes_started: number;
  last_quiz_at: string | null;
}

/** Columns the users API can sort by (mirrors SORT_COLUMNS in /api/admin/users). */
export type UserSortKey =
  | "created_at"
  | "name"
  | "email"
  | "last_sign_in_at"
  | "quizzes_completed"
  | "last_quiz_at";
export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: { key: UserSortKey; dir: SortDir } = { key: "created_at", dir: "desc" };

/**
 * Clicking a header: the same column flips direction; a new column starts on its
 * natural direction (A→Z for text, newest/most first for dates and counts).
 */
export function nextSort(
  current: { key: UserSortKey; dir: SortDir },
  key: UserSortKey
): { key: UserSortKey; dir: SortDir } {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "name" || key === "email" ? "asc" : "desc" };
}

export const PAGE_SIZE = 10;

export const userTypeConfig = {
  student: "Student",
  resident: "Resident",
  fellow: "Fellow",
  attending: "Attending",
  faculty: "Faculty",
  other: "Other",
};

export function getUserDisplayName(user: User): string {
  return user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.email || "Unknown User";
}

export function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages: (number | "ellipsis")[] = [];
  pages.push(0);
  if (currentPage > 2) pages.push("ellipsis");
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages - 2, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 3) pages.push("ellipsis");
  pages.push(totalPages - 1);
  return pages;
}
