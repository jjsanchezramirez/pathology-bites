"use client";

import { Button } from "@/shared/components/ui/button";
import { getABPathPageNumbers } from "./abpath-utils";

interface ABPathPaginationProps {
  currentPage: number;
  totalPages: number;
  totalSections: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function ABPathPagination({
  currentPage,
  totalPages,
  totalSections,
  hasPrevPage,
  hasNextPage,
  loading,
  onPageChange,
}: ABPathPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <span>•</span>
        <span>{totalSections} sections total</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage || loading}
        >
          Previous
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getABPathPageNumbers(currentPage, totalPages).map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "default" : "outline"}
              size="sm"
              className="w-8 h-8 p-0"
              onClick={() => onPageChange(pageNum)}
              disabled={loading}
            >
              {pageNum}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage || loading}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
