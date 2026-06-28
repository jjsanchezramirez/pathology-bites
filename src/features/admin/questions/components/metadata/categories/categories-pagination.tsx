"use client";

import { Button } from "@/shared/components/ui/button";
import { getPageNumbers } from "./categories-utils";

interface CategoriesPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CategoriesPagination({
  page,
  totalPages,
  onPageChange,
}: CategoriesPaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page {page + 1} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
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
