// src/shared/components/data-table/table-pagination.tsx
// Shared pagination row for admin tables — owns the 7-page-window ellipsis
// algorithm that was previously copy-pasted per table.

"use client";

import { Button } from "@/shared/components/ui/button";

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

interface TablePaginationProps {
  /** 0-indexed current page. */
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** Item noun for the "Showing X to Y of Z" line, e.g. "users". */
  itemName?: string;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemName = "items",
  onPageChange,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        Showing {totalItems > 0 ? page * pageSize + 1 : 0} to{" "}
        {Math.min((page + 1) * pageSize, totalItems)} of {totalItems} {itemName}
      </p>
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          Previous
        </Button>
        {getPageNumbers(page, totalPages).map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="min-w-[36px]"
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
