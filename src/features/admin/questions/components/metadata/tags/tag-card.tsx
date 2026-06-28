"use client";

import { memo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Trash2, Edit, Eye } from "lucide-react";
import type { Tag } from "./tags-utils";

export const TagCardSkeleton = memo(function TagCardSkeleton() {
  return (
    <div className="bg-card border rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 bg-muted rounded flex-1" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
});

export const TagCard = memo(function TagCard({
  tag,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onViewQuestions,
}: {
  tag: Tag;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  onViewQuestions: (tag: Tag) => void;
}) {
  return (
    <div
      className={`group relative bg-card border rounded-lg p-3 hover:shadow-sm transition-all duration-200 ${
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/20"
      }`}
    >
      {/* Selection checkbox and tag name */}
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(tag.id)}
          className="h-4 w-4"
        />
        <h3 className="font-medium text-sm truncate flex-1" title={tag.name}>
          {tag.name}
        </h3>
      </div>

      {/* Stats and actions */}
      <div className="flex items-center justify-between">
        <Badge
          variant={tag.question_count === 0 ? "outline" : "secondary"}
          className={`text-xs ${tag.question_count === 0 ? "text-muted-foreground" : ""}`}
        >
          {tag.question_count || 0} questions
        </Badge>

        {/* Simple action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onViewQuestions(tag)}
            title="View questions"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(tag)}
            title="Edit tag"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(tag)}
            title="Delete tag"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
});
