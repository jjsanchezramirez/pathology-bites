// src/shared/components/data-table/table-control-bar.tsx
// Shared search-input + filter-slot row for admin tables.

"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";

interface TableControlBarProps {
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  /** Slot for <Select> filters and action buttons, rendered after the search input. */
  children?: ReactNode;
}

export function TableControlBar({
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
  children,
}: TableControlBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      {children}
    </div>
  );
}
