"use client";

import { Button } from "@/shared/components/ui/button";
import { PAGE_SIZE, getPageNumbers } from "./users-table-utils";

interface UsersPaginationProps {
  page: number;
  totalPages: number;
  totalUsers: number;
  shownCount: number;
  onPageChange: (page: number) => void;
}

export function UsersPagination({
  page,
  totalPages,
  totalUsers,
  shownCount,
  onPageChange,
}: UsersPaginationProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {shownCount > 0 ? page * PAGE_SIZE + 1 : 0} to{" "}
        {Math.min((page + 1) * PAGE_SIZE, totalUsers)} of {totalUsers} users
      </p>
      <div className="flex flex-wrap items-center gap-2">
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
