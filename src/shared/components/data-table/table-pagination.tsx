// src/shared/components/data-table/table-pagination.tsx
// Shared 7-page-window ellipsis algorithm for admin tables — previously
// copy-pasted per table. The per-table pagination rows stay custom (they differ
// in layout and labels); only this algorithm is shared.

/** 0-indexed page window with ellipsis, e.g. [0, "ellipsis", 4, 5, 6, "ellipsis", 19]. */
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
