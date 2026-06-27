// Pure helpers + shared types/consts for the tags management grid.
// Extracted from tags-management-grid.tsx so the sort, pagination, and label logic
// are unit-testable in isolation (see tags-utils.test.ts).

export interface Tag {
  id: string;
  name: string;
  created_at: string;
  question_count?: number;
}

export interface TagQuestion {
  id: string;
  title: string;
  stem: string;
  category?: string;
}

export type SortBy = "name" | "usage" | "date" | "oldest" | "unused";

export const DEFAULT_PAGE_SIZE = 100; // Increased for grid layout
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500] as const;

/** Client-side sort/filter applied to a page of tags. "unused" also filters to count===0. */
export function sortTags(tags: Tag[], sortBy: SortBy): Tag[] {
  let sorted = [...tags];
  switch (sortBy) {
    case "usage":
      sorted.sort((a, b) => (b.question_count || 0) - (a.question_count || 0));
      break;
    case "date":
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case "oldest":
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case "unused":
      sorted = sorted.filter((tag) => (tag.question_count || 0) === 0);
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

export function sortByLabel(sortBy: SortBy): string {
  return sortBy === "name"
    ? "Alphabetical"
    : sortBy === "usage"
      ? "Most Used"
      : sortBy === "date"
        ? "Newest"
        : sortBy === "oldest"
          ? "Oldest"
          : sortBy === "unused"
            ? "Unused Only"
            : "Alphabetical";
}

/** Page-number list for the tags grid pagination (shows up to 5, with "..." gaps). */
export function getTagsPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxPagesToShow = 5;

  if (totalPages <= maxPagesToShow) {
    for (let i = 0; i < totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(0);

    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages - 2, currentPage + 1);

    if (currentPage < 3) {
      end = 3;
    }

    if (currentPage > totalPages - 4) {
      start = totalPages - 4;
    }

    if (start > 1) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages - 1);
  }

  return pages;
}
