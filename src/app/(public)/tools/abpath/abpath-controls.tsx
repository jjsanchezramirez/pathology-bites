"use client";

import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search, X, Download } from "lucide-react";
import type { ABPathCategory } from "./abpath-utils";

interface ABPathControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categories: ABPathCategory[];
  showAP: boolean;
  onToggleAP: () => void;
  showCP: boolean;
  onToggleCP: () => void;
  showC: boolean;
  onToggleC: () => void;
  showAR: boolean;
  onToggleAR: () => void;
  showF: boolean;
  onToggleF: () => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  onExportPDF: () => void;
}

export function ABPathControls({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  showAP,
  onToggleAP,
  showCP,
  onToggleCP,
  showC,
  onToggleC,
  showAR,
  onToggleAR,
  showF,
  onToggleF,
  hasActiveFilters,
  onClear,
  onExportPDF,
}: ABPathControlsProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Section Type Toggles */}
        <div className="flex gap-1">
          <Button variant={showAP ? "default" : "outline"} size="sm" onClick={onToggleAP}>
            AP
          </Button>
          <Button variant={showCP ? "default" : "outline"} size="sm" onClick={onToggleCP}>
            CP
          </Button>
        </div>

        {/* Designation Toggles */}
        <div className="flex gap-1">
          <Button variant={showC ? "default" : "outline"} size="sm" onClick={onToggleC}>
            Core
          </Button>
          <Button variant={showAR ? "default" : "outline"} size="sm" onClick={onToggleAR}>
            AR
          </Button>
          <Button variant={showF ? "default" : "outline"} size="sm" onClick={onToggleF}>
            Fellow
          </Button>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="flex items-center gap-1">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}

        {/* PDF Export */}
        <Button
          onClick={onExportPDF}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <Download className="h-3 w-3" />
          Export PDF
        </Button>
      </div>
    </Card>
  );
}
