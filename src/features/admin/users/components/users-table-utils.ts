// Pure helpers + shared types/config for the users table UI.
// Extracted from users-table.tsx so the display-name, type-label, and pagination
// logic are unit-testable in isolation (see users-table-utils.test.ts).

export interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  user_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const PAGE_SIZE = 10;

export const userTypeConfig = {
  student: "Student",
  resident: "Resident",
  fellow: "Fellow",
  attending: "Attending",
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
